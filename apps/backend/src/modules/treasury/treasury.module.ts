import { Module } from '@nestjs/common';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './services/treasury.service';
import { DailyCloseService } from './operations/daily-close.service';
import { ReconciliationService } from './operations/reconciliation.service';
import { PettyCashService } from './operations/petty-cash.service';

@Module({
  controllers: [TreasuryController],
  providers: [TreasuryService, DailyCloseService, ReconciliationService, PettyCashService],
  exports: [TreasuryService, DailyCloseService],
})
export class TreasuryModule {}
