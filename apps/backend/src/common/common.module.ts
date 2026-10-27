import { Global, Module } from '@nestjs/common';
import { MoneyService } from './money/money.service';

/**
 * Servicios transversales sin estado. Global para que cualquier módulo pueda
 * inyectar `MoneyService` sin repetir el provider (regla M4 de `S-08`).
 */
@Global()
@Module({
  providers: [MoneyService],
  exports: [MoneyService],
})
export class CommonModule {}
