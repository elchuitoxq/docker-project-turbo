import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { BillingModule } from '../billing/billing.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  // Facturar un pedido crea la factura con el mismo motor que la emisión manual (`S-10`, T-10-12) y el
  // histórico necesita ver la cadena pedido → factura (`S-12`).
  imports: [BillingModule, DocumentsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
