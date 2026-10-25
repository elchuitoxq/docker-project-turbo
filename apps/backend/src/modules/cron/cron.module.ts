import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
import { CurrenciesModule } from '../settings/currencies/currencies.module';

@Module({
  imports: [CurrenciesModule],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
