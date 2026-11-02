import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './services/billing.service';
import { PayablesService } from './purchasing/payables.service';
import { SupplierRetentionService } from './purchasing/supplier-retention.service';
import { FiscalSequenceService } from '../reports/fiscal/fiscal-sequence.service';
import { DocumentsModule } from '../documents/documents.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  // Histórico de procesos del documento (`S-12`).
  imports: [DocumentsModule, AccountingModule],
  controllers: [BillingController],
  providers: [BillingService, PayablesService, SupplierRetentionService, FiscalSequenceService],
  exports: [BillingService, PayablesService, SupplierRetentionService],
})
export class BillingModule {}
