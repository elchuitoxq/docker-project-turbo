import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExchangeRateService } from '../settings/currencies/exchange-rate.service';

/**
 * Sincronizacion programada de la tasa oficial del dolar (`T-08-04`).
 *
 * Antes no existia ningun job: la tasa solo se actualizaba si alguien llamaba a
 * `GET /v1/cron/trigger-bcv`. Se retiro ese endpoint (mutaba estado por `GET`) y
 * la sincronizacion manual vive en `POST /v1/settings/currencies/refresh`.
 */
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly exchangeRates: ExchangeRateService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'America/Caracas' })
  async syncDailyBcvRate(): Promise<void> {
    try {
      await this.exchangeRates.syncFromBcv();
    } catch (error) {
      // No se propaga: el job no debe tumbar el proceso. La tasa anterior sigue vigente
      // y la UI avisa por antiguedad; un humano puede hacer override manual.
      this.logger.error(
        `No se pudo sincronizar la tasa BCV: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
