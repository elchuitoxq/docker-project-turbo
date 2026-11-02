/** Tasa de IGTF vigente (3 % sobre base + IVA en operaciones en divisa). */
export const IGTF_RATE = 0.03;

export type TotalsLine = {
  quantity: number;
  price: number;
  taxRate?: number;
  isExempt?: boolean;
};

export type DocumentTotalsPreview = {
  totalBase: number;
  totalTax: number;
  totalIgtf: number;
  total: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Vista previa de totales de una factura, con la **misma** fórmula del backend
 * (`BillingService.calculateInvoiceTotals`).
 *
 * Existe para que el usuario vea lo que va a registrar antes de guardar. Después de crear el documento
 * la fuente de verdad es el `settlement`/`total` que devuelve el servidor: la UI no recalcula importes
 * de documentos ya emitidos.
 */
export function computeDocumentTotals(
  lines: TotalsLine[],
  options: { applyIgtf?: boolean } = {}
): DocumentTotalsPreview {
  let totalBase = 0;
  let totalTax = 0;

  for (const line of lines) {
    const itemBase = line.quantity * line.price;
    totalBase += itemBase;

    if (!line.isExempt && line.taxRate) {
      totalTax += itemBase * (line.taxRate / 100);
    }
  }

  totalBase = round2(totalBase);
  totalTax = round2(totalTax);
  const totalIgtf = options.applyIgtf ? round2((totalBase + totalTax) * IGTF_RATE) : 0;

  return { totalBase, totalTax, totalIgtf, total: round2(totalBase + totalTax + totalIgtf) };
}
