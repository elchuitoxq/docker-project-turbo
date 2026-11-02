import { Module } from '@nestjs/common';
import { DocumentEventsService } from './document-events.service';

/**
 * Histórico de procesos de documentos (`S-12`). Lo consumen facturación y pedidos; se declara como
 * módulo propio para que ambos compartan una única implementación y no dupliquen la consulta de la
 * cadena pedido → factura.
 */
@Module({
  providers: [DocumentEventsService],
  exports: [DocumentEventsService],
})
export class DocumentsModule {}
