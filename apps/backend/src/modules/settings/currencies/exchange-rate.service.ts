import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../../database';
import { currencies, exchangeRates } from '../../../schema';

export type RateSource = 'BCV' | 'MANUAL';

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

  private readonly bcvUrl = 'https://www.bcv.org.ve';
  private readonly maxAgeHours: number;
  private readonly maxVariationPct: number;

  constructor(private readonly config: ConfigService) {
    this.maxAgeHours = Number(this.config.get<string>('EXCHANGE_RATE_MAX_AGE_HOURS') ?? 24);
    this.maxVariationPct = Number(this.config.get<string>('EXCHANGE_RATE_MAX_VARIATION_PCT') ?? 20);
  }

  /** Última tasa de una moneda con su antigüedad y bandera de vencimiento. */
  async getLatestWithFreshness(currencyCode: string): Promise<RateWithFreshness | null> {
    const [latest] = await this.findLatestRows(currencyCode, 1);
    return latest ? this.withFreshness(latest) : null;
  }

  /** Tasa vigente para una fecha concreta (la más reciente hasta esa fecha). */
  async getRateAt(currencyCode: string, date: Date): Promise<RateWithFreshness | null> {
    const currencyId = await this.requireCurrencyId(currencyCode);

    const [row] = await db
      .select(this.selection)
      .from(exchangeRates)
      .innerJoin(currencies, eq(exchangeRates.currencyId, currencies.id))
      .where(and(eq(exchangeRates.currencyId, currencyId), lte(exchangeRates.date, date)))
      .orderBy(desc(exchangeRates.date))
      .limit(1);

    return row ? this.withFreshness(this.toStoredRate(row), date) : null;
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
    const currencyId = await this.requireCurrencyId(input.currencyCode);
    const rate = this.parseRate(input.rate);
    await this.assertSaneVariation(currencyId, rate);

    if (input.source === 'MANUAL' && !input.reason?.trim()) {
      throw new BadRequestException('A manual rate requires a reason');
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

  /** Obtiene la tasa oficial de BCV. Sin respaldos dudosos: falla y se registra. */
  async fetchBcvUsdRate(): Promise<number> {
    const response = await fetch(this.bcvUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`BCV site returned status ${response.status}`);
    }

    return this.parseBcvHtml(await response.text());
  }

  /** Sincroniza la tasa del dólar desde BCV y la persiste con `source=BCV`. */
  async syncFromBcv(): Promise<StoredRate> {
    const rate = await this.fetchBcvUsdRate();
    const stored = await this.store({ currencyCode: 'USD', rate, source: 'BCV' });
    this.logger.log(`Tasa BCV del día registrada: ${stored.rate} (${stored.date.toISOString()})`);
    return stored;
  }

  private async assertSaneVariation(currencyId: string, rate: number): Promise<void> {
    const [previous] = await db
      .select({ rate: exchangeRates.rate })
      .from(exchangeRates)
      .where(eq(exchangeRates.currencyId, currencyId))
      .orderBy(desc(exchangeRates.date))
      .limit(1);

    if (!previous) return;

    const previousRate = Number(previous.rate);
    if (previousRate <= 0) return;

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
    const [currency] = await db
      .select({ id: currencies.id })
      .from(currencies)
      .where(eq(currencies.code, currencyCode))
      .limit(1);

    if (!currency) {
      throw new NotFoundException(`Currency ${currencyCode} not found`);
    }

    return currency.id;
  }

  /** Extrae el valor del dólar del HTML de BCV con las variantes conocidas. */
  private parseBcvHtml(html: string): number {
    const patterns = [
      /<[^>]*id\s*=\s*["']dolar["'][^>]*>.*?([\d.,]+)/is,
      /Dolar\s*<\/td[^>]*>\s*<[^>]*>\s*([\d.,]+)/is,
      /\$?\s*([\d]{2}[.,][\d]{2,4})\s*Bs/,
      /valorDolar\s*=\s*["']([\d.,]+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      const candidate = match?.[1];
      if (!candidate) continue;

      // BCV publica en formato es-VE ("5.432,10"); también aceptamos "36.50".
      const normalized = candidate.includes(',')
        ? candidate.replace(/\./g, '').replace(',', '.')
        : candidate;
      const rate = Number(normalized.replace(/[^\d.]/g, ''));

      if (Number.isFinite(rate) && rate > 0 && rate < 100_000) {
        return rate;
      }
    }

    throw new Error('Could not parse the USD rate from the BCV page');
  }
}
