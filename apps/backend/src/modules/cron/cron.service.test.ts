import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InternalServerErrorException } from '@nestjs/common';
import { CronService } from './cron.service';
import { db } from '../../database';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  },
}));

const FIXTURE_PATH = join(__dirname, '__fixtures__', 'bcv-page.html');

describe('CronService', () => {
  let service: CronService;

  beforeEach(() => {
    service = new CronService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('parseBcvHtml', () => {
    it('extracts USD from "dolar" id pattern', () => {
      const html = '<div id="dolar">36,50</div>';
      // @ts-expect-error - accessing private method for testing
      const result = service.parseBcvHtml(html);
      expect(result).toBe(36.5);
    });

    it('extracts USD from "Dolar" td pattern', () => {
      const html = '<table><tr><td>Dolar</td><td>36,50</td></tr></table>';
      // @ts-expect-error
      const result = service.parseBcvHtml(html);
      expect(result).toBe(36.5);
    });

    it('extracts USD from valorDolar JS variable', () => {
      const html = '<script>var valorDolar = "36.50";</script>';
      // @ts-expect-error
      const result = service.parseBcvHtml(html);
      expect(result).toBe(36.5);
    });

    it('parses the full BCV fixture HTML', () => {
      const html = readFileSync(FIXTURE_PATH, 'utf-8');
      // @ts-expect-error
      const result = service.parseBcvHtml(html);
      expect(result).toBe(36.5);
    });

    it('throws on unparseable HTML', () => {
      const html = '<html><body>No rates here</body></html>';
      // @ts-expect-error
      expect(() => service.parseBcvHtml(html)).toThrow('Could not parse USD rate from BCV page');
    });

    it('rejects out-of-range values', () => {
      const html = '<div id="dolar">5000.00</div>';
      // @ts-expect-error
      expect(() => service.parseBcvHtml(html)).toThrow();
    });
  });

  describe('parseBcvJsonData', () => {
    it('extracts from valid JSON', () => {
      const data = { USD: { fecha: '2026-06-02', euro: '38,50', yuan: '5,00', lira: '1,00', rublo: '0,40' } };
      // @ts-expect-error
      const result = service.parseBcvJsonData(data);
      expect(result).toBeGreaterThan(0);
    });

    it('throws on empty values', () => {
      const data = { USD: {} };
      // @ts-expect-error
      expect(() => service.parseBcvJsonData(data)).toThrow('Invalid BCV JSON data structure');
    });
  });

  describe('storeExchangeRate', () => {
    it('inserts exchange rate when USD currency exists', async () => {
      (db.select as any).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [{ id: 'usd-id' }] }) }),
      });
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

      // @ts-expect-error
      await expect(service.storeExchangeRate(36.5)).resolves.not.toThrow();
      expect(db.insert).toHaveBeenCalled();
    });

    it('throws if USD currency not found', async () => {
      (db.select as any).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [] }) }),
      });

      // @ts-expect-error
      await expect(service.storeExchangeRate(36.5)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('triggerBcvRateFetch', () => {
    it('returns success on happy path', async () => {
      const mockHtml = '<div id="dolar">36,50</div>';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      }));

      (db.select as any).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => [{ id: 'usd-id' }] }) }),
      });
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

      const result = await service.triggerBcvRateFetch();

      expect(result.success).toBe(true);
      expect(result.rate).toBe(36.5);
      expect(result.message).toContain('BCV rate fetched and stored successfully');
    });

    it('returns failure when both sources fail', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await service.triggerBcvRateFetch();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to fetch BCV rate');
      expect(result.rate).toBeUndefined();
    });
  });
});
