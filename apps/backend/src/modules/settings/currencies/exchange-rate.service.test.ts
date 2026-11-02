import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { db } from '../../../database';
import { ExchangeRateService, extractIssuerUrl, isTlsChainError } from './exchange-rate.service';

vi.mock('../../../database', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}));

const FIXTURE_PATH = join(__dirname, '..', '..', 'cron', '__fixtures__', 'bcv-page.html');

function selectChain(rows: unknown[]) {
  const builder: Record<string, unknown> = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

function insertChain(row: Record<string, unknown>) {
  const builder: Record<string, unknown> = {
    values: vi.fn(() => builder),
    onConflictDoUpdate: vi.fn(() => builder),
    returning: vi.fn(() => [row]),
  };
  return builder;
}

describe('helpers de TLS de BCV', () => {
  it('reconoce los errores de cadena incompleta', () => {
    expect(isTlsChainError({ cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } })).toBe(true);
    expect(isTlsChainError({ code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' })).toBe(true);
    expect(isTlsChainError({ cause: { code: 'ENOTFOUND' } })).toBe(false);
    expect(isTlsChainError(new Error('boom'))).toBe(false);
  });

  it('extrae la URL del emisor desde el AIA', () => {
    const infoAccess =
      'CA Issuers - URI:http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt\n' +
      'OCSP - URI:http://ocsp.sectigo.com';
    expect(extractIssuerUrl(infoAccess)).toBe(
      'http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt'
    );
    expect(extractIssuerUrl(undefined)).toBeNull();
    expect(extractIssuerUrl('OCSP - URI:http://ocsp.sectigo.com')).toBeNull();
  });
});

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;

  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` no vacía la cola de `mockReturnValueOnce`: sin esto, un valor encolado
    // por una prueba se consume en la siguiente.
    vi.mocked(db.select).mockReset();
    vi.mocked(db.insert).mockReset();
    service = new ExchangeRateService(new ConfigService({}));
  });

  describe('parseo del HTML de BCV', () => {
    function parse(html: string): number {
      // @ts-expect-error method privado, se prueba por comportamiento
      return service.parseBcvHtml(html);
    }

    it('extrae la tasa del patrón id="dolar"', () => {
      expect(parse('<div id="dolar">36,50</div>')).toBe(36.5);
    });

    it('extrae la tasa del patrón de tabla Dolar', () => {
      expect(parse('<table><tr><td>Dolar</td><td>36,50</td></tr></table>')).toBe(36.5);
    });

    it('extrae la tasa de la variable valorDolar', () => {
      expect(parse('<script>var valorDolar = "36.50";</script>')).toBe(36.5);
    });

    it('parsea el fixture completo de BCV', () => {
      expect(parse(readFileSync(FIXTURE_PATH, 'utf-8'))).toBe(889.5754);
    });

    it('toma el bloque del dólar y no los números de las clases CSS', () => {
      // La página real trae `col-sm-6` y `col-sm-12` antes del valor: el parser viejo
      // devolvía 6 (S-15).
      expect(parse(readFileSync(FIXTURE_PATH, 'utf-8'))).not.toBe(6);
    });

    it('ignora el bloque del euro aunque aparezca primero', () => {
      const html = readFileSync(FIXTURE_PATH, 'utf-8');
      expect(parse(html)).toBe(889.5754);
      expect(html.indexOf('id="euro"')).toBeLessThan(html.indexOf('id="dolar"'));
    });

    it('acepta el valor sin clase strong-tb dentro del bloque del dólar', () => {
      expect(parse('<div id="dolar"><span>USD</span><b>889,5754</b></div>')).toBe(889.5754);
    });

    it('rechaza un bloque sin ningún número con decimales', () => {
      expect(() => parse('<div id="dolar"><span>USD</span></div>')).toThrow(
        'Could not parse the USD rate from the BCV page'
      );
    });

    it('acepta tasas altas (la inflación puede superar 1000)', () => {
      expect(parse('<div id="dolar">5.432,10</div>')).toBe(5432.1);
    });

    it('falla si no encuentra la tasa', () => {
      expect(() => parse('<html><body>No rates here</body></html>')).toThrow(
        'Could not parse the USD rate from the BCV page'
      );
    });
  });

  describe('guarda de cordura al persistir', () => {
    it('rechaza una tasa que se desvía más del umbral', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never)
        .mockReturnValueOnce(selectChain([{ rate: '36.5', date: new Date() }]) as never);

      await expect(service.store({ currencyCode: 'USD', rate: 50, source: 'BCV' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('no compara contra una tasa más vieja que el umbral de antigüedad', async () => {
      // Con una última tasa de hace meses una devaluación fuerte es legítima, no un scrape mal leído.
      vi.mocked(db.select)
        .mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never)
        .mockReturnValueOnce(
          selectChain([{ rate: '36.5', date: new Date(Date.now() - 96 * 3_600_000) }]) as never
        );
      vi.mocked(db.insert).mockReturnValue(
        insertChain({
          id: 'rate-hoy',
          currencyId: 'usd-id',
          rate: '889.5754',
          date: new Date(),
          source: 'BCV',
          reason: null,
          createdBy: null,
        }) as never
      );

      const stored = await service.store({ currencyCode: 'USD', rate: 889.5754, source: 'BCV' });

      expect(stored.rate).toBe(889.5754);
    });

    it('acepta la tasa dentro del umbral y normaliza la fecha al día', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never)
        .mockReturnValueOnce(selectChain([{ rate: '36.5', date: new Date() }]) as never);
      vi.mocked(db.insert).mockReturnValue(
        insertChain({
          id: 'rate-1',
          currencyId: 'usd-id',
          rate: '37.00',
          date: new Date('2026-10-26T00:00:00.000Z'),
          source: 'BCV',
          reason: null,
          createdBy: null,
        }) as never
      );

      const stored = await service.store({
        currencyCode: 'USD',
        rate: 37,
        source: 'BCV',
        date: new Date('2026-10-26T14:35:00.000Z'),
      });

      expect(stored.rate).toBe(37);
      expect(stored.date.toISOString()).toBe('2026-10-26T00:00:00.000Z');
    });

    it('exige motivo en un override manual', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never)
        .mockReturnValueOnce(selectChain([]) as never);

      await expect(
        service.store({ currencyCode: 'USD', rate: 37, source: 'MANUAL' })
      ).rejects.toThrow('A manual rate requires a reason');
    });

    it('un override manual con motivo no lo frena la guarda de variación', async () => {
      // Es la salida que propone el propio mensaje de la guarda: el humano confirma y deja motivo.
      vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never);
      vi.mocked(db.insert).mockReturnValue(
        insertChain({
          id: 'rate-manual',
          currencyId: 'usd-id',
          rate: '889.5754',
          date: new Date('2026-10-31T00:00:00.000Z'),
          source: 'MANUAL',
          reason: 'Se adopta la tasa oficial del entorno',
          createdBy: null,
        }) as never
      );

      const stored = await service.store({
        currencyCode: 'USD',
        rate: 889.5754,
        source: 'MANUAL',
        reason: 'Se adopta la tasa oficial del entorno',
      });

      expect(stored.rate).toBe(889.5754);
      expect(stored.source).toBe('MANUAL');
      // Sólo se consultó la moneda: no se leyó la tasa anterior para comparar.
      expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1);
    });

    it('rechaza tasas no positivas', async () => {
      vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never);

      await expect(service.store({ currencyCode: 'USD', rate: 0, source: 'BCV' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('falla si la moneda no existe', async () => {
      vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never);

      await expect(service.store({ currencyCode: 'XYZ', rate: 10, source: 'BCV' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('rechaza una tasa para la moneda funcional', async () => {
      // VES vale 1 contra sí misma: una fila suya es ruido (el `36,50` sembrado en VES).
      vi.mocked(db.select).mockReturnValueOnce(
        selectChain([{ id: 'ves-id', code: 'VES', isBase: true }]) as never
      );

      await expect(
        service.store({ currencyCode: 'VES', rate: 36.5, source: 'MANUAL', reason: 'x' })
      ).rejects.toThrow('moneda funcional');
    });
  });

  describe('sincronización con BCV', () => {
    const todayRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'rate-today',
      currencyId: 'usd-id',
      currencyCode: 'USD',
      rate: '889.5754',
      date: new Date(),
      source: 'BCV',
      reason: null,
      createdBy: null,
      ...overrides,
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('guarda la tasa cuando el día no tiene ninguna', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          text: async () => readFileSync(FIXTURE_PATH, 'utf-8'),
        }))
      );
      vi.mocked(db.select)
        .mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never)
        .mockReturnValueOnce(selectChain([]) as never)
        .mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never)
        .mockReturnValueOnce(selectChain([{ rate: '880.00' }]) as never);
      vi.mocked(db.insert).mockReturnValue(insertChain(todayRow()) as never);

      const result = await service.syncFromBcv();

      expect(result).toMatchObject({ status: 'stored', rate: 889.5754, source: 'BCV' });
      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    });

    it('no reescribe si BCV publicó el mismo valor', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          text: async () => readFileSync(FIXTURE_PATH, 'utf-8'),
        }))
      );
      vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never);
      vi.mocked(db.select).mockReturnValueOnce(selectChain([todayRow()]) as never);

      const result = await service.syncFromBcv();

      expect(result.status).toBe('unchanged');
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    });

    it('respeta el override manual del día sin consultar BCV', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never);
      vi.mocked(db.select).mockReturnValueOnce(
        selectChain([todayRow({ source: 'MANUAL', reason: 'Feriado bancario' })]) as never
      );

      const result = await service.syncFromBcv();

      expect(result).toMatchObject({ status: 'manual-override', source: 'MANUAL' });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    });

    it('falla si la página responde con error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: false, status: 503 }))
      );
      vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never);
      vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never);

      await expect(service.syncFromBcv()).rejects.toThrow('BCV site returned status 503');
    });

    it('completa la cadena de certificados cuando BCV no envía el intermedio', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(
          Object.assign(new TypeError('fetch failed'), {
            cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' },
          })
        )
      );
      const withChain = vi
        .spyOn(
          service as never as { fetchHtmlWithChain: () => Promise<string> },
          'fetchHtmlWithChain'
        )
        .mockResolvedValue(readFileSync(FIXTURE_PATH, 'utf-8'));
      vi.spyOn(
        service as never as { resolveIssuerChain: () => Promise<string[]> },
        'resolveIssuerChain'
      ).mockResolvedValue(['-----BEGIN CERTIFICATE-----intermedio-----END CERTIFICATE-----']);

      const rate = await service.fetchBcvUsdRate();

      expect(rate).toBe(889.5754);
      expect(withChain).toHaveBeenCalledOnce();
    });

    it('no desactiva la verificación: sin intermedio disponible falla con mensaje claro', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(
          Object.assign(new TypeError('fetch failed'), {
            cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' },
          })
        )
      );
      vi.spyOn(
        service as never as { resolveIssuerChain: () => Promise<string[]> },
        'resolveIssuerChain'
      ).mockResolvedValue([]);

      await expect(service.fetchBcvUsdRate()).rejects.toThrow('cadena de certificados incompleta');
    });
  });

  describe('antigüedad de la tasa', () => {
    it('marca como vencida una tasa de más de 24 horas', async () => {
      const published = new Date(Date.now() - 72 * 3_600_000);
      vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never);
      vi.mocked(db.select).mockReturnValueOnce(
        selectChain([
          {
            id: 'rate-1',
            currencyId: 'usd-id',
            currencyCode: 'USD',
            rate: '36.5',
            date: published,
            source: 'BCV',
            reason: null,
            createdBy: null,
          },
        ]) as never
      );

      const latest = await service.getLatestWithFreshness('USD');

      expect(latest?.isStale).toBe(true);
      expect(latest?.ageHours).toBeGreaterThan(70);
    });

    it('devuelve null cuando no hay tasas registradas', async () => {
      vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never);
      vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never);

      await expect(service.getLatestWithFreshness('USD')).resolves.toBeNull();
    });
  });
});
