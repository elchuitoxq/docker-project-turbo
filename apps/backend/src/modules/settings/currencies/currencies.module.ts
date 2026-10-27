import { Module } from '@nestjs/common';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';
import { ExchangeRateService } from './exchange-rate.service';

@Module({
  controllers: [CurrenciesController],
  providers: [CurrenciesService, ExchangeRateService],
  exports: [CurrenciesService, ExchangeRateService],
})
export class CurrenciesModule {}
