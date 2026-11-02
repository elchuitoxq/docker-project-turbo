import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ExchangeRateService } from '../settings/currencies/exchange-rate.service';
import { InventoryService } from '../inventory/inventory.service';

/**
 * Sincronización programada de la tasa oficial del dólar (`T-08-04`, `S-15`).
 *
 * Corre dos veces por día hábil en hora de Venezuela: a las 09:00 (recoge la publicación de la
 * tarde anterior, que es la que rige la mañana) y a las 17:00 (recoge la del mismo día). La
 * sincronización es idempotente: no reescribe si el valor no cambió y respeta un override manual
 * del día. El disparo manual vive en `POST /v1/settings/currencies/refresh`.
 */
@Injectable()
export class CronService implements OnModuleInit {
  private readonly logger = new Logger(CronService.name);
  private readonly enabled: boolean;
  private readonly expiryBlockEnabled: boolean;

  constructor(
    private readonly exchangeRates: ExchangeRateService,
    private readonly inventory: InventoryService,
    private readonly config: ConfigService
  ) {
    this.enabled = (this.config.get<string>('EXCHANGE_RATE_SYNC_ENABLED') ?? 'true') !== 'false';
    this.expiryBlockEnabled =
      (this.config.get<string>('INVENTORY_EXPIRY_BLOCK_ENABLED') ?? 'true') !== 'false';
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.warn('Sincronización automática de la tasa BCV deshabilitada');
    } else {
      this.logger.log(
        'Sincronización de la tasa BCV programada: 09:00 y 17:00 (America/Caracas, L-V)'
      );
    }

    if (!this.expiryBlockEnabled) {
      this.logger.warn('Bloqueo automático de lotes vencidos deshabilitado');
    } else {
      this.logger.log('Bloqueo de lotes vencidos programado: 00:05 (America/Caracas)');
    }
  }

  @Cron('0 9,17 * * 1-5', { timeZone: 'America/Caracas' })
  async syncDailyBcvRate(): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Sincronización de la tasa BCV deshabilitada por configuración');
      return;
    }

    try {
      const result = await this.exchangeRates.syncFromBcv();
      this.logger.log(`Sincronización BCV: ${result.status} · ${result.rate} (${result.source})`);
    } catch (error) {
      // No se propaga: el job no debe tumbar el proceso. La tasa anterior sigue vigente
      // y la UI avisa por antigüedad; un humano puede hacer override manual.
      this.logger.error(
        `No se pudo sincronizar la tasa BCV: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Bloqueo automático de lotes vencidos (`S-26`).
   *
   * Corre al inicio del día en hora de Venezuela. Un lote que venció deja de poder despacharse sin
   * depender de que alguien lo marque a mano; la baja del stock sigue siendo un ajuste con motivo.
   */
  @Cron('5 0 * * *', { timeZone: 'America/Caracas' })
  async blockExpiredBatches(): Promise<void> {
    if (!this.expiryBlockEnabled) {
      this.logger.debug('Bloqueo de lotes vencidos deshabilitado por configuración');
      return;
    }

    try {
      const { blocked } = await this.inventory.blockExpiredBatches();
      this.logger.log(
        blocked.length === 0
          ? 'Bloqueo de lotes vencidos: sin novedades'
          : `Bloqueo de lotes vencidos: ${blocked.length} lote(s) — ${blocked
              .map(batch => batch.batchNumber)
              .join(', ')}`
      );
    } catch (error) {
      // Igual que la sincronización de la tasa: el job no tumba el proceso; el despacho ya rechaza
      // el lote vencido por su fecha aunque el bloqueo no se haya ejecutado.
      this.logger.error(
        `No se pudieron bloquear los lotes vencidos: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
