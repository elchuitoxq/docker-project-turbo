import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CronService } from './cron.service';

describe('CronService', () => {
  const exchangeRates = { syncFromBcv: vi.fn() };
  const inventory = { blockExpiredBatches: vi.fn() };

  function build(env: Record<string, string> = {}): CronService {
    return new CronService(exchangeRates as never, inventory as never, new ConfigService(env));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  it('sincroniza la tasa del día', async () => {
    exchangeRates.syncFromBcv.mockResolvedValue({
      status: 'stored',
      rate: 889.5754,
      date: new Date(),
      source: 'BCV',
    });

    await build().syncDailyBcvRate();

    expect(exchangeRates.syncFromBcv).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('stored · 889.5754'));
  });

  it('no propaga el error del scraping y deja la tasa anterior vigente', async () => {
    exchangeRates.syncFromBcv.mockRejectedValue(new Error('Network error'));

    await expect(build().syncDailyBcvRate()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo sincronizar la tasa BCV')
    );
  });

  it('no consulta BCV cuando la sincronización está deshabilitada', async () => {
    await build({ EXCHANGE_RATE_SYNC_ENABLED: 'false' }).syncDailyBcvRate();

    expect(exchangeRates.syncFromBcv).not.toHaveBeenCalled();
  });

  it('bloquea los lotes vencidos y registra cuáles', async () => {
    inventory.blockExpiredBatches.mockResolvedValue({
      blocked: [{ id: 'b1', batchNumber: 'L-VENCIDO' }],
    });

    await build().blockExpiredBatches();

    expect(inventory.blockExpiredBatches).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('L-VENCIDO'));
  });

  it('no propaga el error del bloqueo de lotes', async () => {
    inventory.blockExpiredBatches.mockRejectedValue(new Error('DB down'));

    await expect(build().blockExpiredBatches()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('No se pudieron bloquear los lotes vencidos')
    );
  });

  it('no bloquea lotes cuando el job está deshabilitado', async () => {
    await build({ INVENTORY_EXPIRY_BLOCK_ENABLED: 'false' }).blockExpiredBatches();

    expect(inventory.blockExpiredBatches).not.toHaveBeenCalled();
  });
});
