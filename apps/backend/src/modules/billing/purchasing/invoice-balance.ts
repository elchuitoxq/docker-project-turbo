import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { db } from '../../../database';
import {
  creditNotes,
  creditNoteUsages,
  invoices,
  paymentAllocations,
  payments,
  taxRetentions,
} from '../../../schema';

/** Estados en los que una nota de crédito sigue descontando saldo: emitida o ya consumida. */
export const ACTIVE_CREDIT_NOTE_STATUSES = ['POSTED', 'APPLIED'];

/**
 * Saldo exigible de una factura (`T-03-05`, `S-18`).
 *
 * `saldo = total − pagado − notas de crédito − retenciones`. La retención se descuenta porque el
 * proveedor cobra el neto: en la compra de 1.000 + 160 con retención de 120 el saldo real es 1.040
 * (escenario de aceptación de `S-03`), no 1.160.
 *
 * Todo se expresa en la moneda del documento, que es la unidad de `invoices.total`. El pagado se
 * suma desde `payment_allocations.invoice_amount`, que ya viene expresado en esa moneda: un cobro en
 * divisa de una factura en bolívares rebaja el saldo por su equivalente del día, y un cobro en la
 * misma moneda rebaja **a la par** aunque la tasa haya cambiado. Antes se dividía el importe en
 * moneda funcional por la tasa congelada de la factura, lo que sobre-imputaba cuando la tasa del día
 * era distinta (`S-18`).
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
    .select({
      invoiceAmount: paymentAllocations.invoiceAmount,
      amount: paymentAllocations.amount,
      status: payments.status,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(eq(paymentAllocations.invoiceId, invoiceId));

  // `invoice_amount` ya está en la moneda del documento. El fallback cubre filas anteriores a la
  // migración `0027` que no lo tuvieran calculado.
  const paid = allocations
    .filter(row => row.status === 'POSTED')
    .reduce((sum, row) => sum + Number(row.invoiceAmount ?? row.amount ?? 0), 0);

  // Toda nota de crédito emitida contra la factura rebaja el saldo, sea devolución a cliente
  // (`SALE`) o a proveedor (`PURCHASE`). Antes se filtraba por `PURCHASE`, así que una devolución de
  // venta dejaba el saldo del cliente intacto y la factura no podía cerrarse (`S-18`).
  //
  // Cuenta tanto `POSTED` como `APPLIED`: una nota totalmente aplicada sigue siendo un crédito
  // emitido; si se dejara fuera, el saldo de la factura volvería a subir al consumirla.
  const notes = await db
    .select({ total: creditNotes.total })
    .from(creditNotes)
    .where(
      and(
        eq(creditNotes.invoiceId, invoiceId),
        inArray(creditNotes.status, ACTIVE_CREDIT_NOTE_STATUSES)
      )
    );

  // Notas de crédito **sin factura de origen** (o aplicadas a otra factura): el crédito se descuenta
  // cuando se aplica a esta factura (`credit_note_usages.invoice_id`). Las que tienen esta factura
  // como origen ya descontaron su total arriba, así que sus usos no se suman otra vez.
  const appliedNotes = await db
    .select({ amount: creditNoteUsages.amount })
    .from(creditNoteUsages)
    .innerJoin(creditNotes, eq(creditNotes.id, creditNoteUsages.creditNoteId))
    .where(
      and(
        eq(creditNoteUsages.invoiceId, invoiceId),
        inArray(creditNotes.status, ACTIVE_CREDIT_NOTE_STATUSES),
        or(isNull(creditNotes.invoiceId), ne(creditNotes.invoiceId, invoiceId))
      )
    );

  const credited =
    notes.reduce((sum, row) => sum + Number(row.total ?? 0), 0) +
    appliedNotes.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const retentions = await db
    .select({ totalRetained: taxRetentions.totalRetained })
    .from(taxRetentions)
    .where(eq(taxRetentions.invoiceId, invoiceId));

  const retained = retentions.reduce((sum, row) => sum + Number(row.totalRetained ?? 0), 0);

  return summarizeBalance({ total: Number(invoice.total ?? 0), paid, credited, retained });
}
