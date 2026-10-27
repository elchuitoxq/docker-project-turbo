import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CurrenciesModule } from '../settings/currencies/currencies.module';

@Module({
  imports: [CurrenciesModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
