/** Etiquetas y variantes de estado comunes a facturas y pedidos (`S-10`). */
const LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Emitida',
  PAID: 'Pagada',
  // Estado de las compras con abono parcial (`S-03`): sin etiqueta salía el enum crudo.
  PARTIAL: 'Abonada',
  VOID: 'Anulada',
  VOIDED: 'Anulada',
  CANCELLED: 'Anulada',
  APPLIED: 'Aplicada',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'En proceso',
  COMPLETED: 'Completado',
  PENDING: 'Pendiente',
};

const VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  POSTED: 'default',
  PAID: 'default',
  PARTIAL: 'outline',
  VOID: 'destructive',
  VOIDED: 'destructive',
  CANCELLED: 'destructive',
  APPLIED: 'outline',
  CONFIRMED: 'default',
  PROCESSING: 'default',
  COMPLETED: 'default',
  PENDING: 'secondary',
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return LABEL[status] ?? status;
}

export function statusVariant(
  status: string | null | undefined
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!status) return 'secondary';
  return VARIANT[status] ?? 'secondary';
}

/** `DOC-2026-0001` → prefijo legible para la cabecera. */
export function documentKindLabel(type: 'SALE' | 'PURCHASE' | string | null | undefined): string {
  return type === 'PURCHASE' ? 'Compra' : 'Venta';
}
