import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestCurrency,
  createTestInvoice,
  createTestInvoiceItem,
  createTestPartner,
  createTestProduct,
} from './factories';
import { creditNotes, fiscalExports, fiscalSequences } from '../schema';
import { FiscalBookService } from '../modules/reports/fiscal/fiscal-book.service';
import { FiscalValidationService } from '../modules/reports/fiscal/fiscal-validation.service';
import { FiscalExportService } from '../modules/reports/fiscal/fiscal-export.service';
import { FiscalSequenceService } from '../modules/reports/fiscal/fiscal-sequence.service';
import { checkDigit } from '../modules/reports/fiscal/rif.validator';

/**
 * Reportes fiscales contra Postgres real (`T-06-01` … `T-06-05`). Lo que se verifica es que el libro
 * no mezcle sucursales ni monedas, y que una exportación quede registrada con su hash.
 */

const books = new FiscalBookService();
const sequences = new FiscalSequenceService();
const validation = new FiscalValidationService();
const exportsService = new FiscalExportService();

/** `partners.tax_id` es único y la base de test persiste: los RIF de prueba deben ser únicos. */
function uniqueInvalidRif(): string {
  return `X${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** RIF con dígito verificador correcto, para que la validación no sume advertencias inesperadas. */
function validRif(prefix = 'J'): string {
  const digits = faker.string.numeric(8);
  return `${prefix}-${digits}-${checkDigit(digits)}`;
}

async function salesScenario() {
  const branch = await createTestBranch();
  const currency = await createTestCurrency({ name: 'Bolívar de prueba' });
  const partner = await createTestPartner({ taxId: validRif(), type: 'CUSTOMER' });
  const product = await createTestProduct();

  const invoice = await createTestInvoice(partner.id, branch.id, currency.id, {
    status: 'POSTED',
    type: 'SALE',
    exchangeRate: '1.0000',
    totalBase: '300.00',
    totalTax: '48.00',
    total: '348.00',
    date: new Date('2026-10-10T00:00:00.000Z'),
  });
  await createTestInvoiceItem(invoice.id, product.id, {
    taxRate: '16.00',
    total: '300.00',
    price: '300.00',
  });

  return { branch, currency, partner, product, invoice };
}

describe('Secuencia fiscal (T-06-01)', () => {
  it('numera sin huecos por sucursal, documento y año', async () => {
    const branch = await createTestBranch();
    const year = 2026;

    const first = await sequences.next(branch.id, 'RETENTION_IVA', year);
    const second = await sequences.next(branch.id, 'RETENTION_IVA', year);
    const third = await sequences.next(branch.id, 'RETENTION_IVA', year);

    expect([first, second, third]).toEqual([1, 2, 3]);
    expect(await sequences.current(branch.id, 'RETENTION_IVA', year)).toBe(3);
    expect(sequences.format('RETENTION_IVA', year, 42)).toBe('RET-2026-000042');
  });

  it('cada tipo de documento lleva su propia secuencia', async () => {
    const branch = await createTestBranch();

    expect(await sequences.next(branch.id, 'RETENTION_IVA', 2026)).toBe(1);
    expect(await sequences.next(branch.id, 'RETENTION_ISLR', 2026)).toBe(1);
    expect(await sequences.next(branch.id, 'RETENTION_IVA', 2027)).toBe(1);
  });

  it('no comparte números entre sucursales', async () => {
    const first = await createTestBranch();
    const second = await createTestBranch();

    expect(await sequences.next(first.id, 'INVOICE', 2026)).toBe(1);
    expect(await sequences.next(second.id, 'INVOICE', 2026)).toBe(1);
  });
});

describe('Libro de ventas (T-06-02)', () => {
  it('suma la base y el IVA de las líneas y cuadra', async () => {
    const { branch } = await salesScenario();

    const book = await books.build(branch.id, 'SALES', '2026-10-01', '2026-10-31');

    expect(book.rows).toHaveLength(1);
    expect(book.totals.base).toBe(300);
    expect(book.totals.tax).toBe(48);
    expect(book.totals.total).toBe(348);
    expect(book.totals.byRate).toEqual([{ rate: 16, base: 300, tax: 48 }]);
    expect(book.consistent).toBe(true);
  });

  it('convierte a moneda funcional con la tasa del documento', async () => {
    const branch = await createTestBranch();
    const currency = await createTestCurrency({ name: 'Divisa de prueba' });
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct();

    const invoice = await createTestInvoice(partner.id, branch.id, currency.id, {
      status: 'POSTED',
      type: 'SALE',
      exchangeRate: '36.500000',
      totalBase: '100.00',
      totalTax: '16.00',
      total: '116.00',
      date: new Date('2026-10-12T00:00:00.000Z'),
    });
    await createTestInvoiceItem(invoice.id, product.id, {
      taxRate: '16.00',
      total: '100.00',
      price: '100.00',
    });

    const book = await books.build(branch.id, 'SALES', '2026-10-01', '2026-10-31');

    // 116 USD → 4.234 VES; base 3.650 y IVA 584.
    expect(book.totals.base).toBe(3_650);
    expect(book.totals.tax).toBe(584);
    expect(book.totals.total).toBe(4_234);
  });

  it('no mezcla sucursales', async () => {
    const { branch } = await salesScenario();
    const other = await createTestBranch();

    const book = await books.build(other.id, 'SALES', '2026-10-01', '2026-10-31');

    expect(book.rows).toHaveLength(0);
    expect(book.totals.total).toBe(0);
    expect(book.branchId).toBe(other.id);
  });

  it('las notas de crédito restan', async () => {
    const { branch, currency, partner, invoice } = await salesScenario();

    await testDb.insert(creditNotes).values({
      code: `CN-${faker.string.numeric(6)}`,
      invoiceId: invoice.id,
      partnerId: partner.id,
      branchId: branch.id,
      currencyId: currency.id,
      exchangeRate: '1.0000',
      status: 'POSTED',
      totalBase: '300.00',
      totalTax: '48.00',
      total: '348.00',
      date: new Date('2026-10-20T00:00:00.000Z'),
    });

    const book = await books.build(branch.id, 'SALES', '2026-10-01', '2026-10-31');

    expect(book.rows).toHaveLength(2);
    expect(book.rows[1].documentType).toBe('CREDIT_NOTE');
    // La NC anula la venta: los importes quedan en negativo y el neto del libro en cero.
    expect(book.rows[1].base).toBe(-300);
    expect(book.totals.total).toBe(0);
    expect(book.totals.base).toBe(0);
    expect(book.totals.tax).toBe(0);
  });

  it('excluye documentos que no están posteados', async () => {
    const { branch, currency, partner, product } = await salesScenario();

    const draft = await createTestInvoice(partner.id, branch.id, currency.id, {
      status: 'DRAFT',
      type: 'SALE',
      date: new Date('2026-10-15T00:00:00.000Z'),
    });
    await createTestInvoiceItem(draft.id, product.id, { total: '116.00' });

    const book = await books.build(branch.id, 'SALES', '2026-10-01', '2026-10-31');

    expect(book.rows).toHaveLength(1);
  });
});

describe('Validación fiscal (T-06-04)', () => {
  it('detecta RIF con formato inválido', async () => {
    const branch = await createTestBranch();
    const currency = await createTestCurrency({ name: 'Divisa de prueba' });
    const partner = await createTestPartner({ taxId: uniqueInvalidRif(), type: 'CUSTOMER' });

    await createTestInvoice(partner.id, branch.id, currency.id, {
      status: 'POSTED',
      type: 'SALE',
      date: new Date('2026-10-11T00:00:00.000Z'),
    });

    const result = await validation.validate(branch.id, '2026-10-01', '2026-10-31');

    expect(result.canExport).toBe(false);
    expect(result.findings.some(finding => finding.code === 'RIF_INVALID')).toBe(true);
  });

  it('detecta huecos en la numeración A-', async () => {
    const branch = await createTestBranch();
    const currency = await createTestCurrency({ name: 'Divisa de prueba' });
    const partner = await createTestPartner({ type: 'CUSTOMER' });

    // `invoices.code` es único y la base de test persiste: se busca un tramo libre.
    const base = Number(faker.string.numeric(5));
    for (const code of [`A-${base}`, `A-${base + 2}`]) {
      await createTestInvoice(partner.id, branch.id, currency.id, {
        code,
        status: 'POSTED',
        type: 'SALE',
        date: new Date('2026-10-13T00:00:00.000Z'),
      });
    }

    const result = await validation.validate(branch.id, '2026-10-01', '2026-10-31');
    const gap = result.findings.find(finding => finding.code === 'SEQUENCE_GAP');

    expect(gap?.severity).toBe('WARNING');
    expect(gap?.message).toMatch(/Faltan 1/);
  });

  it('deja exportar cuando sólo hay advertencias', async () => {
    const { branch } = await salesScenario();

    const result = await validation.validate(branch.id, '2026-10-01', '2026-10-31');

    expect(result.errors).toBe(0);
    expect(result.canExport).toBe(true);
  });
});

describe('Exportación fiscal (T-06-05)', () => {
  it('registra el archivo con hash y correlativo', async () => {
    const { branch } = await salesScenario();

    const result = await exportsService.export({
      branchId: branch.id,
      reportType: 'LIBRO_VENTAS',
      format: 'CSV',
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(result.code).toBe('FIS-2026-000001');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.content).toContain('TOTALES');

    const [saved] = await testDb
      .select()
      .from(fiscalExports)
      .where(eq(fiscalExports.id, result.id));
    expect(saved.hash).toBe(result.hash);
    expect(saved.sequenceNumber).toBe(1);
  });

  it('bloquea la exportación si hay errores de validación', async () => {
    const branch = await createTestBranch();
    const currency = await createTestCurrency({ name: 'Divisa de prueba' });
    const partner = await createTestPartner({ taxId: uniqueInvalidRif(), type: 'CUSTOMER' });

    await createTestInvoice(partner.id, branch.id, currency.id, {
      status: 'POSTED',
      type: 'SALE',
      date: new Date('2026-10-14T00:00:00.000Z'),
    });

    await expect(
      exportsService.export({
        branchId: branch.id,
        reportType: 'LIBRO_VENTAS',
        format: 'CSV',
        from: '2026-10-01',
        to: '2026-10-31',
      })
    ).rejects.toThrow(/bloqueada/);

    const rows = await testDb
      .select()
      .from(fiscalExports)
      .where(eq(fiscalExports.branchId, branch.id));
    expect(rows).toHaveLength(0);

    const sequenceRows = await testDb
      .select()
      .from(fiscalSequences)
      .where(eq(fiscalSequences.branchId, branch.id));
    expect(sequenceRows).toHaveLength(0);
  });

  it('cada exportación consume un correlativo', async () => {
    const { branch } = await salesScenario();

    const first = await exportsService.export({
      branchId: branch.id,
      reportType: 'LIBRO_VENTAS',
      format: 'CSV',
      from: '2026-10-01',
      to: '2026-10-31',
    });
    const second = await exportsService.export({
      branchId: branch.id,
      reportType: 'LIBRO_VENTAS',
      format: 'CSV',
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(first.sequenceNumber).toBe(1);
    expect(second.sequenceNumber).toBe(2);
    expect(first.hash).toBe(second.hash);
  });
});
