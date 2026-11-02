import { Module } from '@nestjs/common';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './services/treasury.service';
import { DailyCloseService } from './operations/daily-close.service';
import { ReconciliationService } from './operations/reconciliation.service';
import { PettyCashService } from './operations/petty-cash.service';
// El pago de una factura cierra la cadena documental: el histórico del documento lo registra el
// mismo servicio que usan pedidos y facturación (`S-16` M-22).
import { DocumentsModule } from '../documents/documents.module';
// Contabilización del cobro/pago (`S-18`).
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [DocumentsModule, AccountingModule],
  controllers: [TreasuryController],
  providers: [TreasuryService, DailyCloseService, ReconciliationService, PettyCashService],
  exports: [TreasuryService, DailyCloseService],
})
export class TreasuryModule {}
