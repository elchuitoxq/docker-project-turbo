import { Module } from '@nestjs/common';
import { CurrenciesModule } from './currencies/currencies.module';
import { BanksModule } from './banks/banks.module';
import { TaxConceptsModule } from './tax-concepts/tax-concepts.module';

@Module({
  imports: [CurrenciesModule, BanksModule, TaxConceptsModule],
  exports: [CurrenciesModule, BanksModule, TaxConceptsModule],
})
export class SettingsModule {}
