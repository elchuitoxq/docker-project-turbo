import { and, eq } from 'drizzle-orm';
import { db } from '../../../database';
import {
  creditNotes,
  invoices,
  paymentAllocations,
  payments,
  taxRetentions,
} from '../../../schema';

/**
 * Saldo exigible de una factura (`T-03-05`).
 *
 * `saldo = total − pagado − notas de crédito de compra − retenciones`. La retención se descuenta
 * porque el proveedor cobra el neto: en la compra de 1.000 + 160 con retención de 120 el saldo real
 * es 1.040 (escenario de aceptación de `S-03`), no 1.160.
 *
 * Todo se expresa en la moneda del documento, que es la unidad de `invoices.total`. El pagado se
 * toma de las asignaciones de pagos `POSTED` y se convierte con la tasa de la factura, de modo que un
 * cobro en bolívares de una factura en divisa deje el saldo en cero y la diferencia cambiaria viva en
 * el pago (`metadata.exchangeDifference`). `invoices.paid_amount` es sólo una caché de ese valor.
 */
export type InvoiceBalance = {
  total: number;
  paid: number;
  credited: number;
  retained: number;
  settled: number;
  balance: number;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export function summarizeBalance(input: {
  total: number;
  paid: number;
  credited: number;
  retained: number;
}): InvoiceBalance {
  const total = round2(input.total);
  const paid = round2(input.paid);
  const credited = round2(input.credited);
  const retained = round2(input.retained);
  const settled = round2(paid + credited + retained);

  return { total, paid, credited, retained, settled, balance: round2(total - settled) };
}

/** Saldo de una factura concreta; `null` si no existe. */
export async function computeInvoiceBalance(invoiceId: string): Promise<InvoiceBalance | null> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) return null;

  const invoiceRate = Number(invoice.exchangeRate ?? 1) || 1;

  const allocations = await db
    .select({ amountBase: paymentAllocations.amountBase, status: payments.status })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(eq(paymentAllocations.invoiceId, invoiceId));

  const paidBase = allocations
    .filter(row => row.status === 'POSTED')
    .reduce((sum, row) => sum + Number(row.amountBase ?? 0), 0);
  const paid = paidBase / invoiceRate;

  const notes = await db
    .select({ total: creditNotes.total })
    .from(creditNotes)
    .where(
      and(
        eq(creditNotes.invoiceId, invoiceId),
        eq(creditNotes.type, 'PURCHASE'),
        eq(creditNotes.status, 'POSTED')
      )
    );

  const credited = notes.reduce((sum, row) => sum + Number(row.total ?? 0), 0);

  const retentions = await db
    .select({ totalRetained: taxRetentions.totalRetained })
    .from(taxRetentions)
    .where(eq(taxRetentions.invoiceId, invoiceId));

  const retained = retentions.reduce((sum, row) => sum + Number(row.totalRetained ?? 0), 0);

  return summarizeBalance({ total: Number(invoice.total ?? 0), paid, credited, retained });
}
