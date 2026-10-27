import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './services/billing.service';
import { PayablesService } from './purchasing/payables.service';
import { SupplierRetentionService } from './purchasing/supplier-retention.service';
import { FiscalSequenceService } from '../reports/fiscal/fiscal-sequence.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, PayablesService, SupplierRetentionService, FiscalSequenceService],
  exports: [BillingService, PayablesService, SupplierRetentionService],
})
export class BillingModule {}
