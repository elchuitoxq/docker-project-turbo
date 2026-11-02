/**
 * Estados de una factura ya emitida (`S-06`, `S-16` M-15).
 *
 * Una vez que el documento sale del borrador sigue siendo fiscalmente válido aunque esté cobrado:
 * `PARTIAL` y `PAID` describen la cobranza, no la emisión. Todo reporte que pregunte “¿qué facturé?”
 * tiene que usar esta lista y no sólo `POSTED`, o la venta desaparece del libro en cuanto el cliente
 * paga una parte.
 */
export const ISSUED_INVOICE_STATUSES = ['POSTED', 'PAID', 'PARTIAL'] as const;

export type IssuedInvoiceStatus = (typeof ISSUED_INVOICE_STATUSES)[number];

/** `true` si el estado corresponde a un documento emitido (no borrador ni anulado). */
export function isIssuedInvoiceStatus(status: string | null | undefined): boolean {
  return ISSUED_INVOICE_STATUSES.includes(status as IssuedInvoiceStatus);
}
