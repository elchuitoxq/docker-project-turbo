import { describe, expect, it } from 'vitest';
import { computeDocumentTotals } from './totals';

/**
 * Vista previa de totales de los formularios (`T-09-10`).
 *
 * La fórmula tiene que ser la del backend (`BillingService.calculateInvoiceTotals`): si la UI muestra
 * un total distinto al que se registra, el usuario firma un documento que no vio. Los casos cubren las
 * tres piezas: base, IVA por línea (con exentos) e IGTF sólo en ventas en divisa.
 */
describe('computeDocumentTotals', () => {
  it('suma base e IVA por línea', () => {
    const totals = computeDocumentTotals([
      { quantity: 2, price: 50, taxRate: 16 },
      { quantity: 1, price: 100, taxRate: 16 },
    ]);

    expect(totals.totalBase).toBe(200);
    expect(totals.totalTax).toBe(32);
    expect(totals.totalIgtf).toBe(0);
    expect(totals.total).toBe(232);
  });

  it('respeta los productos exentos de IVA', () => {
    const totals = computeDocumentTotals([
      { quantity: 1, price: 100, taxRate: 16, isExempt: true },
      { quantity: 1, price: 100, taxRate: 16 },
    ]);

    expect(totals.totalBase).toBe(200);
    expect(totals.totalTax).toBe(16);
  });

  it('aplica el IGTF del 3 % sobre base + IVA cuando se le pide', () => {
    const totals = computeDocumentTotals([{ quantity: 1, price: 100, taxRate: 16 }], {
      applyIgtf: true,
    });

    // Mismo número que la factura A-90022 verificada en vivo: 100 + 16 + 3,48 = 119,48.
    expect(totals.totalIgtf).toBe(3.48);
    expect(totals.total).toBe(119.48);
  });

  it('redondea a dos decimales sin arrastrar centavos', () => {
    const totals = computeDocumentTotals([{ quantity: 3, price: 33.333, taxRate: 16 }]);

    expect(totals.totalBase).toBe(100);
    expect(totals.totalTax).toBe(16);
    expect(totals.total).toBe(116);
  });

  it('devuelve ceros sin líneas', () => {
    expect(computeDocumentTotals([])).toEqual({
      totalBase: 0,
      totalTax: 0,
      totalIgtf: 0,
      total: 0,
    });
  });
});
