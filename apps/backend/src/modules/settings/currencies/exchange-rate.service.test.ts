import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../database';
import { ExchangeRateService } from './exchange-rate.service';

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

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(parse(readFileSync(FIXTURE_PATH, 'utf-8'))).toBe(36.5);
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
        .mockReturnValueOnce(selectChain([{ rate: '36.5' }]) as never);

      await expect(service.store({ currencyCode: 'USD', rate: 50, source: 'BCV' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('acepta la tasa dentro del umbral y normaliza la fecha al día', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(selectChain([{ id: 'usd-id' }]) as never)
        .mockReturnValueOnce(selectChain([{ rate: '36.5' }]) as never);
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
