import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { X509Certificate } from 'node:crypto';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { rootCertificates } from 'node:tls';
import { connect as tlsConnect } from 'node:tls';
import { db } from '../../../database';
import { currencies, exchangeRates } from '../../../schema';

export type RateSource = 'BCV' | 'MANUAL';

/** Moneda de referencia del sistema: contra ella se publica la tasa oficial (S-08). */
export const REFERENCE_CURRENCY_CODE = 'USD';

/** Errores de TLS que significan "falta un eslabón de la cadena", no "el certificado es falso". */
const CHAIN_ERRORS = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
]);

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
};

/** `true` si el fallo es de cadena de certificados (BCV no envía el intermedio). */
export function isTlsChainError(error: unknown): boolean {
  const code = (error as { cause?: { code?: string }; code?: string } | undefined)?.cause?.code;
  const own = (error as { code?: string } | undefined)?.code;
  return CHAIN_ERRORS.has(code ?? '') || CHAIN_ERRORS.has(own ?? '');
}

/** Extrae la URL del certificado del emisor desde el bloque `infoAccess` de un X509. */
export function extractIssuerUrl(infoAccess: string | undefined): string | null {
  return /CA Issuers - URI:(\S+)/i.exec(infoAccess ?? '')?.[1] ?? null;
}

export interface RateRow {
  id: string;
  currencyId: string;
  currencyCode: string;
  rate: string;
  date: Date | null;
  source: string | null;
  reason: string | null;
  createdBy: string | null;
}

export interface StoredRate {
  id: string;
  currencyId: string;
  currencyCode: string;
  rate: number;
  date: Date;
  source: string;
  reason: string | null;
  createdBy: string | null;
}

export interface RateWithFreshness extends StoredRate {
  /** Horas transcurridas desde la publicación de la tasa. */
  ageHours: number;
  /** `true` si supera el umbral configurado y la UI debe pedir confirmación. */
  isStale: boolean;
}

export interface StoreRateInput {
  currencyCode: string;
  rate: number | string;
  source: RateSource;
  date?: Date;
  createdBy?: string | null;
  reason?: string | null;
}

/** Resultado de una sincronización con BCV. */
export type SyncStatus = 'stored' | 'unchanged' | 'manual-override';

export interface SyncResult {
  status: SyncStatus;
  rate: number;
  date: Date;
  source: string;
}

/**
 * Dueño único de la tasa de cambio (`S-08`).
 *
 * - Normaliza la fecha al inicio del día: el índice único `(currency_id, date)`
 *   garantiza **una tasa por moneda y día**.
 * - Valida cordura antes de escribir: positiva y dentro del desvío permitido
 *   respecto de la última tasa conocida.
 * - Expone la antigüedad para que la emisión pueda advertir (`M9`/`T-08-10`).
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  private readonly bcvUrl: string;
  private readonly maxAgeHours: number;
  private readonly maxVariationPct: number;
  /** Intermedios ya descargados por URL de AIA (viven lo que vive el proceso). */
  private readonly issuerCache = new Map<string, string>();

  constructor(private readonly config: ConfigService) {
    this.maxAgeHours = Number(this.config.get<string>('EXCHANGE_RATE_MAX_AGE_HOURS') ?? 24);
    this.maxVariationPct = Number(this.config.get<string>('EXCHANGE_RATE_MAX_VARIATION_PCT') ?? 20);
    this.bcvUrl =
      this.config.get<string>('BCV_API_URL') ??
      'https://www.bcv.org.ve/seccionportal/tipo-de-cambio-oficial-del-bcv';
  }

  /** Última tasa de una moneda con su antigüedad y bandera de vencimiento. */
  async getLatestWithFreshness(currencyCode: string): Promise<RateWithFreshness | null> {
    const [latest] = await this.findLatestRows(currencyCode, 1);
    return latest ? this.withFreshness(latest) : null;
  }

  /** Tasa vigente para una fecha concreta (la más reciente hasta esa fecha). */
  async getRateAt(currencyCode: string, date: Date): Promise<RateWithFreshness> {
    const currencyId = await this.requireCurrencyId(currencyCode);

    const [row] = await db
      .select(this.selection)
      .from(exchangeRates)
      .innerJoin(currencies, eq(exchangeRates.currencyId, currencies.id))
      .where(and(eq(exchangeRates.currencyId, currencyId), lte(exchangeRates.date, date)))
      .orderBy(desc(exchangeRates.date))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`No exchange rate registered for ${currencyCode}`);
    }

    return this.withFreshness(this.toStoredRate(row), date);
  }

  async history(currencyCode: string, from?: Date, to?: Date, limit = 50): Promise<StoredRate[]> {
    const currencyId = await this.requireCurrencyId(currencyCode);

    const conditions = [eq(exchangeRates.currencyId, currencyId)];
    if (from) conditions.push(gte(exchangeRates.date, from));
    if (to) conditions.push(lte(exchangeRates.date, to));

    const rows = await db
      .select(this.selection)
      .from(exchangeRates)
      .innerJoin(currencies, eq(exchangeRates.currencyId, currencies.id))
      .where(and(...conditions))
      .orderBy(desc(exchangeRates.date))
      .limit(Math.min(Math.max(limit, 1), 365));

    return rows.map(row => this.toStoredRate(row));
  }

  /**
   * Guarda una tasa del día. Un override manual reemplaza la tasa del día para esa
   * moneda (no crea duplicados) y exige motivo.
   */
  async store(input: StoreRateInput): Promise<StoredRate> {
    const currency = await this.requireCurrency(input.currencyCode);
    const currencyId = currency.id;

    if (currency.isBase) {
      // La moneda funcional no se convierte contra sí misma: su tasa es 1 por definición (`S-08`).
      throw new BadRequestException(
        `${currency.code} es la moneda funcional: no lleva tasa (vale 1 contra sí misma)`
      );
    }

    const rate = this.parseRate(input.rate);

    if (input.source === 'MANUAL') {
      if (!input.reason?.trim()) {
        throw new BadRequestException('A manual rate requires a reason');
      }
      // Un override manual con motivo es una decisión humana explícita: salta la guarda de
      // variación (es justo la salida que propone el mensaje de error de la propia guarda).
    } else {
      await this.assertSaneVariation(currencyId, rate);
    }

    const day = this.startOfDay(input.date ?? new Date());

    const [row] = await db
      .insert(exchangeRates)
      .values({
        currencyId,
        rate: rate.toString(),
        date: day,
        source: input.source,
        createdBy: input.createdBy ?? null,
        reason: input.reason ?? null,
      })
      .onConflictDoUpdate({
        target: [exchangeRates.currencyId, exchangeRates.date],
        set: {
          rate: rate.toString(),
          source: input.source,
          createdBy: input.createdBy ?? null,
          reason: input.reason ?? null,
        },
      })
      .returning();

    return {
      id: row.id,
      currencyId: row.currencyId,
      currencyCode: input.currencyCode,
      rate: Number(row.rate),
      date: row.date ?? day,
      source: row.source ?? input.source,
      reason: row.reason,
      createdBy: row.createdBy,
    };
  }

  /**
   * Obtiene la tasa oficial de BCV. Sin respaldos dudosos: falla y se registra.
   *
   * `www.bcv.org.ve` no envía el certificado intermedio de su cadena, así que `fetch` falla con
   * `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. En vez de desactivar la verificación, se descarga el
   * intermedio publicado en el AIA del propio certificado y se reintenta **con verificación**
   * (`S-15`).
   */
  async fetchBcvUsdRate(): Promise<number> {
    try {
      const response = await fetch(this.bcvUrl, {
        method: 'GET',
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`BCV site returned status ${response.status}`);
      }

      return this.parseBcvHtml(await response.text());
    } catch (error) {
      if (!isTlsChainError(error)) throw error;

      const chain = await this.resolveIssuerChain(this.bcvUrl);
      if (chain.length === 0) {
        throw new Error(
          `BCV presentó una cadena de certificados incompleta y no se pudo completar: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      this.logger.warn(
        'BCV no envió la cadena completa del certificado: se completó con el emisor publicado en el AIA'
      );
      return this.parseBcvHtml(await this.fetchHtmlWithChain(this.bcvUrl, chain));
    }
  }

  /** GET con `node:https` confiando en el bundle de raíces de Node **más** los eslabones del AIA. */
  private fetchHtmlWithChain(url: string, chain: string[], redirects = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = url.startsWith('https:') ? httpsGet : httpGet;
      const req = request(
        url,
        { headers: BROWSER_HEADERS, ca: [...rootCertificates, ...chain] },
        response => {
          const status = response.statusCode ?? 0;
          const location = response.headers.location;

          if (status >= 300 && status < 400 && location && redirects < 3) {
            response.resume();
            resolve(
              this.fetchHtmlWithChain(new URL(location, url).toString(), chain, redirects + 1)
            );
            return;
          }

          if (status !== 200) {
            response.resume();
            reject(new Error(`BCV site returned status ${status}`));
            return;
          }

          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          response.on('error', reject);
        }
      );

      req.setTimeout(10_000, () => req.destroy(new Error('BCV request timed out')));
      req.on('error', reject);
    });
  }

  /**
   * Descarga el certificado del emisor que BCV no envía, siguiendo el AIA del certificado
   * presentado. Se cachea por URL: el intermedio cambia cada pocos meses, no cada sincronización.
   */
  private async resolveIssuerChain(url: string): Promise<string[]> {
    const host = new URL(url).hostname;
    const peer = await this.peerCertificate(host);
    if (!peer) return [];

    const issuerUrl = extractIssuerUrl(peer.infoAccess);
    if (!issuerUrl) return [];

    const cached = this.issuerCache.get(issuerUrl);
    if (cached) return [cached];

    try {
      const der = await this.downloadBinary(issuerUrl);
      const pem = new X509Certificate(der).toString();
      this.issuerCache.set(issuerUrl, pem);
      return [pem];
    } catch (error) {
      this.logger.error(
        `No se pudo descargar el certificado intermedio de ${issuerUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  /** Certificado que presenta el servidor (sin usarlo para transportar contenido). */
  private peerCertificate(host: string): Promise<X509Certificate | null> {
    return new Promise(resolve => {
      const socket = tlsConnect(
        { host, port: 443, servername: host, rejectUnauthorized: false },
        () => {
          const raw = socket.getPeerCertificate().raw;
          socket.end();
          resolve(raw ? new X509Certificate(raw) : null);
        }
      );

      socket.setTimeout(8_000, () => {
        socket.destroy();
        resolve(null);
      });
      socket.on('error', () => resolve(null));
    });
  }

  private downloadBinary(url: string, redirects = 0): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const request = url.startsWith('https:') ? httpsGet : httpGet;
      const req = request(url, { headers: BROWSER_HEADERS }, response => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location && redirects < 3) {
          response.resume();
          resolve(this.downloadBinary(new URL(location, url).toString(), redirects + 1));
          return;
        }

        if (status !== 200) {
          response.resume();
          reject(new Error(`status ${status}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });

      req.setTimeout(8_000, () => req.destroy(new Error('AIA request timed out')));
      req.on('error', reject);
    });
  }

  /**
   * Sincroniza la tasa del dólar desde BCV y la persiste con `source=BCV`.
   *
   * Es idempotente: si el día ya tiene una tasa manual (decisión humana) no se pisa, y si el
   * valor publicado no cambió tampoco se reescribe. Así el cron puede correr varias veces al
   * día sin generar ruido ni perder el override de un humano.
   */
  async syncFromBcv(): Promise<SyncResult> {
    const today = this.startOfDay(new Date());
    const [existing] = await this.findLatestRows('USD', 1);

    if (existing && this.startOfDay(existing.date).getTime() === today.getTime()) {
      if (existing.source === 'MANUAL' && existing.reason?.trim()) {
        this.logger.warn(
          `Tasa del día con override manual (${existing.rate}): no se sobrescribe con la de BCV`
        );
        return {
          status: 'manual-override',
          rate: existing.rate,
          date: existing.date,
          source: existing.source,
        };
      }
    }

    const rate = await this.fetchBcvUsdRate();

    if (
      existing &&
      existing.rate === rate &&
      this.startOfDay(existing.date).getTime() === today.getTime()
    ) {
      this.logger.log(`Tasa BCV sin cambios: ${rate}`);
      return { status: 'unchanged', rate, date: today, source: 'BCV' };
    }

    const stored = await this.store({ currencyCode: 'USD', rate, source: 'BCV' });
    this.logger.log(`Tasa BCV del día registrada: ${stored.rate} (${stored.date.toISOString()})`);

    return { status: 'stored', rate: stored.rate, date: stored.date, source: stored.source };
  }

  private async assertSaneVariation(currencyId: string, rate: number): Promise<void> {
    const [previous] = await db
      .select({ rate: exchangeRates.rate, date: exchangeRates.date, source: exchangeRates.source })
      .from(exchangeRates)
      .where(eq(exchangeRates.currencyId, currencyId))
      .orderBy(desc(exchangeRates.date))
      .limit(1);

    if (!previous) return;

    // Una tasa de fixture no es referencia real: la primera sincronización debe poder reemplazarla.
    if (previous.source === 'TEST') {
      this.logger.warn('La tasa anterior es de fixture (TEST): no se compara variación');
      return;
    }

    const previousRate = Number(previous.rate);
    if (previousRate <= 0) return;

    // La guarda compara contra la tasa anterior para detectar un scraping mal leído. Si esa tasa
    // es más vieja que el umbral de antigüedad, no hay comparación razonable: en cinco meses la
    // tasa puede multiplicarse y eso no es un error del parser (S-15).
    const previousAgeHours = (Date.now() - (previous.date ?? new Date()).getTime()) / 3_600_000;
    if (previousAgeHours > this.maxAgeHours) {
      this.logger.warn(
        `La tasa anterior (${previousRate}) tiene ${Math.round(previousAgeHours)} h: no se compara variación`
      );
      return;
    }

    const variation = Math.abs((rate - previousRate) / previousRate) * 100;
    if (variation > this.maxVariationPct) {
      throw new BadRequestException(
        `Exchange rate variation of ${variation.toFixed(2)}% exceeds the allowed ${this.maxVariationPct}% (previous ${previousRate}). Confirm it manually with a reason.`
      );
    }
  }

  private async findLatestRows(currencyCode: string, limit: number): Promise<StoredRate[]> {
    const currencyId = await this.requireCurrencyId(currencyCode);

    const rows = await db
      .select(this.selection)
      .from(exchangeRates)
      .innerJoin(currencies, eq(exchangeRates.currencyId, currencies.id))
      .where(eq(exchangeRates.currencyId, currencyId))
      .orderBy(desc(exchangeRates.date))
      .limit(limit);

    return rows.map(row => this.toStoredRate(row));
  }

  private toStoredRate(row: RateRow): StoredRate {
    return {
      id: row.id,
      currencyId: row.currencyId,
      currencyCode: row.currencyCode,
      rate: Number(row.rate),
      date: row.date ?? new Date(),
      source: row.source ?? 'MANUAL',
      reason: row.reason,
      createdBy: row.createdBy,
    };
  }

  private get selection() {
    return {
      id: exchangeRates.id,
      currencyId: exchangeRates.currencyId,
      currencyCode: currencies.code,
      rate: exchangeRates.rate,
      date: exchangeRates.date,
      source: exchangeRates.source,
      reason: exchangeRates.reason,
      createdBy: exchangeRates.createdBy,
    };
  }

  private withFreshness(row: StoredRate, reference = new Date()): RateWithFreshness {
    const publishedAt = row.date ?? reference;
    const ageHours = Math.max(0, (reference.getTime() - publishedAt.getTime()) / 3_600_000);

    return {
      ...row,
      ageHours: Number(ageHours.toFixed(2)),
      isStale: ageHours > this.maxAgeHours,
    };
  }

  private parseRate(rate: number | string): number {
    const parsed = typeof rate === 'number' ? rate : Number(rate);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`Invalid exchange rate: ${rate}`);
    }
    return parsed;
  }

  private startOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
  }

  private async requireCurrencyId(currencyCode: string): Promise<string> {
    const currency = await this.requireCurrency(currencyCode);
    return currency.id;
  }

  private async requireCurrency(
    currencyCode: string
  ): Promise<{ id: string; code: string; isBase: boolean }> {
    const [currency] = await db
      .select({ id: currencies.id, code: currencies.code, isBase: currencies.isBase })
      .from(currencies)
      .where(eq(currencies.code, currencyCode))
      .limit(1);

    if (!currency) {
      throw new NotFoundException(`Currency ${currencyCode} not found`);
    }

    return { id: currency.id, code: currency.code, isBase: Boolean(currency.isBase) };
  }

  /**
   * Extrae el valor del dólar del HTML de BCV.
   *
   * La página oficial (`/seccionportal/tipo-de-cambio-oficial-del-bcv`) publica cada moneda en un
   * bloque con `id` propio (`dolar`, `euro`, `yuan`, `lira`, `rublo`) y el valor en un
   * `<strong class="strong-tb">` con formato es-VE (`889,57540000`). Buscar "el primer número que
   * aparezca" devolvía `6` (de `col-sm-6`): por eso primero se acota al bloque del dólar.
   */
  private parseBcvHtml(html: string): number {
    const dolarBlock = this.extractDolarBlock(html);

    const candidates: (string | undefined)[] = [
      // 1. `<strong class="strong-tb">889,57540000</strong>` dentro del bloque del dólar.
      dolarBlock
        ? (/class=["'][^"']*strong-tb[^"']*["'][^>]*>\s*([\d.,]+)\s*</i.exec(dolarBlock)?.[1] ??
          undefined)
        : undefined,
      // 2. Primer número con decimales del bloque del dólar (evita enteros como el `6`).
      dolarBlock
        ? /\b(\d{1,3}(?:\.\d{3})*,\d{2,}|\d+[.,]\d{2,})\b/.exec(dolarBlock)?.[1]
        : undefined,
      // 3. Variable de script con la que BCV publica el valor en algunas secciones.
      /valorDolar\s*=\s*["']([\d.,]+)["']/i.exec(html)?.[1],
      // 4. Fila de tabla con la etiqueta `Dólar`.
      /D[oó]lar\s*<\/td[^>]*>\s*<[^>]*>\s*([\d.,]+)/i.exec(html)?.[1],
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const rate = this.normalizeRate(candidate);
      if (rate !== null) return rate;
    }

    throw new Error('Could not parse the USD rate from the BCV page');
  }

  /** Acota el HTML al bloque de la moneda `dolar`. */
  private extractDolarBlock(html: string): string | null {
    const start = html.search(/id\s*=\s*["']dolar["']/i);
    if (start === -1) return null;

    const rest = html.slice(start);
    const end = rest.search(/id\s*=\s*["'](euro|yuan|lira|rublo)["']/i);
    return end === -1 ? rest.slice(0, 4_000) : rest.slice(0, end);
  }

  /** Normaliza un número en formato es-VE (`1.234,56`) o en formato simple (`1234.56`). */
  private normalizeRate(candidate: string): number | null {
    const cleaned = candidate.trim().replace(/\s/g, '');
    const hasComma = cleaned.includes(',');

    // BCV publica en es-VE ("889,57540000"); también aceptamos "36.50".
    const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
    const rate = Number(normalized.replace(/[^\d.]/g, ''));

    if (!Number.isFinite(rate) || rate <= 0 || rate >= 1_000_000) return null;
    return rate;
  }
}
