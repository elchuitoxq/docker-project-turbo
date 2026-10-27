import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FinancialReportsController } from './financial-reports.controller';
import { FinancialReportsService } from './financial-reports.service';
import { FiscalBookService } from './fiscal/fiscal-book.service';
import { FiscalSequenceService } from './fiscal/fiscal-sequence.service';
import { FiscalValidationService } from './fiscal/fiscal-validation.service';
import { FiscalExportService } from './fiscal/fiscal-export.service';

@Module({
  controllers: [ReportsController, FinancialReportsController],
  providers: [
    ReportsService,
    FinancialReportsService,
    FiscalBookService,
    FiscalSequenceService,
    FiscalValidationService,
    FiscalExportService,
  ],
  exports: [
    ReportsService,
    FinancialReportsService,
    FiscalBookService,
    FiscalSequenceService,
    FiscalValidationService,
    FiscalExportService,
  ],
})
export class ReportsModule {}
