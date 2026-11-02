import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database';
import { documentEvents, invoices, users } from '../../schema';
import { eq, asc, inArray, or } from 'drizzle-orm';

/** Documento al que pertenece un evento del histórico. */
export type DocumentType = 'ORDER' | 'INVOICE';

/** Acciones que dejan rastro en el histórico (`S-12`). */
export type DocumentAction =
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'ORDER_INVOICED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_POSTED'
  | 'INVOICE_VOIDED'
  | 'PAYMENT_REGISTERED'
  | 'PAYMENT_VOIDED';

export type DocumentEventInput = {
  documentType: DocumentType;
  documentId: string;
  documentCode?: string | null;
  /** Pedido de origen: es lo que permite leer la cadena completa desde la factura. */
  parentDocumentId?: string | null;
  action: DocumentAction;
  fromStatus?: string | null;
  toStatus?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  userId?: string | null;
  branchId?: string | null;
};

export type DocumentEventDto = {
  id: string;
  documentType: DocumentType;
  documentId: string;
  documentCode: string | null;
  parentDocumentId: string | null;
  action: DocumentAction;
  fromStatus: string | null;
  toStatus: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  userName: string | null;
  createdAt: Date | null;
};

/**
 * Histórico de procesos de pedidos y facturas (`S-12`).
 *
 * Escribe una fila por acción de negocio y devuelve la **cadena completa**: al consultar un pedido se
 * incluyen los eventos de su factura, y al consultar la factura se incluyen los del pedido que la
 * originó. La escritura nunca interrumpe la petición: si falla, se registra el error y se continúa.
 */
@Injectable()
export class DocumentEventsService {
  private readonly logger = new Logger(DocumentEventsService.name);

  async record(input: DocumentEventInput): Promise<void> {
    try {
      await db.insert(documentEvents).values({
        documentType: input.documentType,
        documentId: input.documentId,
        documentCode: input.documentCode ?? null,
        parentDocumentId: input.parentDocumentId ?? null,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        description: input.description ?? null,
        metadata: (input.metadata ?? null) as never,
        userId: input.userId ?? null,
        branchId: input.branchId ?? null,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar ${input.action} de ${input.documentType} ${input.documentId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Eventos de un pedido **y** de las facturas que salieron de él, en orden cronológico. */
  async forOrder(orderId: string): Promise<DocumentEventDto[]> {
    return this.chainFor(orderId);
  }

  /** Eventos de una factura **y** los del pedido que la originó, en orden cronológico. */
  async forInvoice(invoiceId: string): Promise<DocumentEventDto[]> {
    const [invoice] = await db
      .select({ orderId: invoices.orderId })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    return this.chainFor(invoice?.orderId ?? invoiceId);
  }

  /**
   * Cadena a partir del pedido raíz. Si el id recibido no es un pedido (factura sin pedido de origen),
   * la raíz es la propia factura y sólo se ven sus eventos.
   */
  private async chainFor(rootId: string): Promise<DocumentEventDto[]> {
    const relatedInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.orderId, rootId));

    const documentIds = [rootId, ...relatedInvoices.map(invoice => invoice.id)];

    const rows = await db
      .select({ event: documentEvents, userName: users.name })
      .from(documentEvents)
      .leftJoin(users, eq(users.id, documentEvents.userId))
      .where(
        or(
          inArray(documentEvents.documentId, documentIds),
          inArray(documentEvents.parentDocumentId, documentIds)
        )
      )
      .orderBy(asc(documentEvents.createdAt));

    return rows.map(({ event, userName }) => ({
      id: event.id,
      documentType: event.documentType as DocumentType,
      documentId: event.documentId,
      documentCode: event.documentCode,
      parentDocumentId: event.parentDocumentId,
      action: event.action as DocumentAction,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      description: event.description,
      metadata: (event.metadata ?? null) as Record<string, unknown> | null,
      userId: event.userId,
      userName: userName ?? null,
      createdAt: event.createdAt,
    }));
  }
}
