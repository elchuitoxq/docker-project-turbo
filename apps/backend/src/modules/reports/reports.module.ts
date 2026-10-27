import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FinancialReportsController } from './financial-reports.controller';
import { FinancialReportsService } from './financial-reports.service';

@Module({
  controllers: [ReportsController, FinancialReportsController],
  providers: [ReportsService, FinancialReportsService],
  exports: [ReportsService, FinancialReportsService],
})
export class ReportsModule {}
