import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrService } from './services/hr.service';
import { PayrollCalculator } from './payroll/payroll.calculator';
import { LaborBenefits } from './payroll/labor-benefits';
import { CurrenciesModule } from '../settings/currencies/currencies.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [CurrenciesModule, TreasuryModule, AccountingModule],
  controllers: [HrController],
  providers: [HrService, PayrollCalculator, LaborBenefits],
  exports: [HrService],
})
export class HrModule {}
