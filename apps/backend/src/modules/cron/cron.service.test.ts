import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CronService } from './cron.service';

describe('CronService', () => {
  const exchangeRates = { syncFromBcv: vi.fn() };
  let service: CronService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new CronService(exchangeRates as never);
  });

  it('sincroniza la tasa del dia', async () => {
    exchangeRates.syncFromBcv.mockResolvedValue({ rate: 36.5 });

    await service.syncDailyBcvRate();

    expect(exchangeRates.syncFromBcv).toHaveBeenCalledTimes(1);
  });

  it('no propaga el error del scraping y deja la tasa anterior vigente', async () => {
    exchangeRates.syncFromBcv.mockRejectedValue(new Error('Network error'));

    await expect(service.syncDailyBcvRate()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo sincronizar la tasa BCV')
    );
  });
});
