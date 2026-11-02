import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CurrenciesModule } from '../settings/currencies/currencies.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [CurrenciesModule, InventoryModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
