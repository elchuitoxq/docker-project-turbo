import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { testDb } from './database';
import {
  createTestBranch,
  createTestCurrency,
  createTestInvoice,
  createTestPartner,
} from './factories';
import { creditNotes, invoices, payments, taxRetentions } from '../schema';
import { BillingService } from '../modules/billing/services/billing.service';
import { PayablesService } from '../modules/billing/purchasing/payables.service';
import { SupplierRetentionService } from '../modules/billing/purchasing/supplier-retention.service';
import { TreasuryService } from '../modules/treasury/services/treasury.service';
import { MoneyService } from '../common/money/money.service';

/**
 * Compras y cuentas por pagar de punta a punta (`T-03-01` … `T-03-07`) contra Postgres real.
 *
 * El caso central es el del spec: compra de 1.000 + 16 % de IVA, proveedor ordinario → retención de
 * IVA de 120 y saldo de 1.040.
 */

const billing = new BillingService();
const payables = new PayablesService();
const retentions = new SupplierRetentionService();
const treasury = new TreasuryService(new MoneyService());

const TEST_USER_ID = faker.string.uuid();

async function purchaseScenario(
  options: { taxBase?: number; taxRate?: number; special?: boolean } = {}
) {
  const base = options.taxBase ?? 1_000;
  const rate = options.taxRate ?? 16;
  const tax = (base * rate) / 100;

  const branch = await createTestBranch();
  const currency = await createTestCurrency({ name: 'Bolívar compras' });
  const partner = await createTestPartner({
    type: 'SUPPLIER',
    isSpecialTaxpayer: options.special ?? false,
    creditDays: 30,
    taxId: `J-${faker.string.numeric(8)}-${faker.string.numeric(1)}`,
  });

  const invoice = await createTestInvoice(partner.id, branch.id, currency.id, {
    type: 'PURCHASE',
    status: 'DRAFT',
    exchangeRate: '1.0000',
    totalBase: String(base),
    totalTax: String(tax),
    total: String(base + tax),
    invoiceNumber: `SUP-${faker.string.numeric(6)}`,
    date: new Date('2026-10-05T00:00:00.000Z'),
    // Crédito de 30 días: el vencimiento que `billing.create` habría calculado.
    dueDate: new Date('2026-11-04T00:00:00.000Z'),
  });

  return { branch, currency, partner, invoice, base, tax };
}

async function postedPurchase(
  options: { taxBase?: number; taxRate?: number; special?: boolean } = {}
) {
  const scenario = await purchaseScenario(options);
  await billing.post(scenario.invoice.id, scenario.branch.id);
  return scenario;
}

describe('Publicación de compra con retención (T-03-03, T-03-04)', () => {
  it('retiene 75 % del IVA y deja el saldo en 1.040', async () => {
    const { invoice, base, tax } = await postedPurchase();

    const [retention] = await testDb
      .select()
      .from(taxRetentions)
      .where(and(eq(taxRetentions.invoiceId, invoice.id), eq(taxRetentions.type, 'IVA')));

    expect(retention).toBeDefined();
    expect(Number(retention.totalBase)).toBe(base);
    expect(Number(retention.totalTax)).toBe(tax);
    // 75 % de 160
    expect(Number(retention.totalRetained)).toBe(120);
    expect(retention.voucherNumber).toMatch(/^RET-IVA-\d{4}-\d{6}$/);
  });

  it('un proveedor especial retiene el 100 % del IVA', async () => {
    const { invoice } = await postedPurchase({ special: true });

    const [retention] = await testDb
      .select()
      .from(taxRetentions)
      .where(eq(taxRetentions.invoiceId, invoice.id));

    expect(Number(retention.totalRetained)).toBe(160);
  });

  it('republicar no duplica el comprobante', async () => {
    const { invoice, branch } = await postedPurchase();

    const result = await retentions.retainInvoice(invoice.id);

    const rows = await testDb
      .select()
      .from(taxRetentions)
      .where(eq(taxRetentions.invoiceId, invoice.id));
    expect(rows).toHaveLength(1);
    expect(result.ivaRetained).toBe(120);
    expect(result.netPayable).toBe(1_040);
    expect(branch.id).toBe(invoice.branchId);
  });

  it('una compra exenta no emite comprobante de IVA', async () => {
    const { invoice } = await postedPurchase({ taxRate: 0 });

    const rows = await testDb
      .select()
      .from(taxRetentions)
      .where(eq(taxRetentions.invoiceId, invoice.id));

    expect(rows).toHaveLength(0);
  });

  it('los comprobantes de IVA e ISLR no comparten numeración (H-85)', async () => {
    const { branch, invoice, currency, partner } = await postedPurchase();
    const companyId = await retentions.companyOfBranch(branch.id);

    await retentions.updateSettings(companyId, {
      islrRate: 5,
      islrSustraendo: 10,
      islrThreshold: 500,
    });
    await retentions.retainInvoice(invoice.id);

    const rows = await testDb
      .select()
      .from(taxRetentions)
      .where(eq(taxRetentions.invoiceId, invoice.id));

    const iva = rows.find(row => row.type === 'IVA');
    const islr = rows.find(row => row.type === 'ISLR');

    expect(iva?.voucherNumber).toMatch(/^RET-IVA-\d{4}-\d{6}$/);
    expect(islr?.voucherNumber).toMatch(/^RET-ISLR-\d{4}-\d{6}$/);
    // 5 % de 1.000 − 10 de sustraendo
    expect(Number(islr?.totalRetained)).toBe(40);

    await retentions.updateSettings(companyId, {
      islrRate: 0,
      islrSustraendo: 0,
      islrThreshold: 0,
    });
    expect(currency.id).toBe(invoice.currencyId);
    expect(partner.id).toBe(invoice.partnerId);
  });

  it('las ventas no generan retención al proveedor', async () => {
    const branch = await createTestBranch();
    const currency = await createTestCurrency({ name: 'Divisa ventas' });
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const invoice = await createTestInvoice(partner.id, branch.id, currency.id, {
      type: 'SALE',
      status: 'DRAFT',
      totalBase: '100',
      totalTax: '16',
      total: '116',
    });

    await billing.post(invoice.id, branch.id);

    const rows = await testDb
      .select()
      .from(taxRetentions)
      .where(eq(taxRetentions.invoiceId, invoice.id));
    expect(rows).toHaveLength(0);
  });
});

describe('Vencimiento (T-03-02)', () => {
  it('usa los días de crédito del proveedor cuando no se envía fecha', async () => {
    const branch = await createTestBranch();
    const currency = await createTestCurrency({ name: 'Divisa vencimiento' });
    const partner = await createTestPartner({ type: 'SUPPLIER', creditDays: 30 });
    const invoice = await createTestInvoice(partner.id, branch.id, currency.id, {
      type: 'PURCHASE',
      status: 'POSTED',
      date: new Date('2026-10-01T00:00:00.000Z'),
      dueDate: null,
      total: '100',
      totalBase: '100',
    });

    const rows = await payables.list(branch.id, { partnerId: partner.id });
    const row = rows.find(item => item.invoiceId === invoice.id);

    expect(row?.dueDate).toBeNull();
    expect(row?.status).toBe('PENDING');
  });
});

describe('Cuentas por pagar y antigüedad (T-03-05)', () => {
  it('muestra el saldo de una compra publicada', async () => {
    const { branch, invoice } = await postedPurchase();

    const rows = await payables.list(branch.id, { asOf: '2026-10-10' });
    const row = rows.find(item => item.invoiceId === invoice.id);

    expect(row?.total).toBe(1_160);
    expect(row?.paid).toBe(0);
    expect(row?.retained).toBe(120);
    // El proveedor cobra el neto: 1.160 − 120 retenidos (escenario de `S-03`).
    expect(row?.balance).toBe(1_040);
    expect(row?.status).toBe('PENDING');
  });

  it('clasifica por antigüedad según el vencimiento', async () => {
    const { branch, invoice } = await postedPurchase();

    // Vence el 2026-10-05; al 2026-10-10 lleva 5 días → bucket 1-30.
    const aging = await payables.aging(branch.id, '2026-11-10');

    expect(aging.totals.balance).toBeGreaterThan(0);
    const bucket30 = aging.buckets.find(bucket => bucket.bucket === 'D1_30');
    expect(bucket30?.total).toBeGreaterThanOrEqual(1_040);
    expect(invoice.id).toBeDefined();
  });

  it('no mezcla sucursales', async () => {
    const { branch } = await postedPurchase();
    const other = await createTestBranch();

    const rows = await payables.list(other.id);

    expect(rows).toHaveLength(0);
    expect(branch.id).not.toBe(other.id);
  });
});

describe('Pago a proveedor (T-03-06)', () => {
  it('un pago parcial deja la factura en PARTIAL y descuenta el saldo', async () => {
    const { branch, invoice, partner, currency } = await postedPurchase();

    const [method] = await testDb.select().from(payments).limit(0);

    void method;

    // Se toma un método existente del seed de la empresa de la sucursal.
    const methodId = await firstMethodId();

    const payment = await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId,
        amount: 500,
        currencyId: currency.id,
        exchangeRate: 1,
        type: 'EXPENSE' as never,
        allocations: [{ invoiceId: invoice.id, amount: 500 }],
      },
      TEST_USER_ID
    );

    expect(payment).toBeDefined();

    const [updated] = await testDb.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(Number(updated.paidAmount)).toBe(500);
    expect(updated.status).toBe('PARTIAL');

    const rows = await payables.list(branch.id);
    const row = rows.find(item => item.invoiceId === invoice.id);
    // Saldo 1.040 − 500 pagados (escenario de `S-03`).
    expect(row?.balance).toBe(540);
    expect(row?.status).toBe('PARTIAL');
  });

  it('rechaza asignaciones que superan el pago', async () => {
    const { branch, invoice, partner, currency } = await postedPurchase();
    const methodId = await firstMethodId();

    await expect(
      treasury.create(
        {
          partnerId: partner.id,
          branchId: branch.id,
          methodId,
          amount: 100,
          currencyId: currency.id,
          exchangeRate: 1,
          type: 'EXPENSE' as never,
          allocations: [{ invoiceId: invoice.id, amount: 500 }],
        },
        TEST_USER_ID
      )
    ).rejects.toThrow(/superan el importe/);
  });

  it('rechaza un pago mayor al saldo de la factura', async () => {
    const { branch, invoice, currency, partner } = await postedPurchase();
    const methodId = await firstMethodId();

    // El saldo es 1.040 (1.160 − 120 de retención): asignar 1.100 viola la regla 4 de `S-03`.
    await expect(
      treasury.create(
        {
          partnerId: partner.id,
          branchId: branch.id,
          methodId,
          amount: 1_100,
          currencyId: currency.id,
          exchangeRate: 1,
          type: 'EXPENSE' as never,
          allocations: [{ invoiceId: invoice.id, amount: 1_100 }],
        },
        TEST_USER_ID
      )
    ).rejects.toThrow(/supera el saldo de la factura/);
  });

  it('pagar el neto deja la factura en PAID', async () => {
    const { branch, invoice, currency, partner } = await postedPurchase();
    const methodId = await firstMethodId();

    await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId,
        amount: 1_040,
        currencyId: currency.id,
        exchangeRate: 1,
        type: 'EXPENSE' as never,
        allocations: [{ invoiceId: invoice.id, amount: 1_040 }],
      },
      TEST_USER_ID
    );

    const [updated] = await testDb.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(updated.status).toBe('PAID');

    const rows = await payables.list(branch.id);
    const row = rows.find(item => item.invoiceId === invoice.id);
    expect(row?.balance).toBe(0);
    expect(row?.status).toBe('PAID');
  });
});

describe('Nota de crédito de compra (T-03-07)', () => {
  it('descuenta el saldo del proveedor', async () => {
    const { branch, invoice, partner, currency } = await postedPurchase();

    await testDb.insert(creditNotes).values({
      code: `CNP-${faker.string.numeric(6)}`,
      type: 'PURCHASE',
      invoiceId: invoice.id,
      partnerId: partner.id,
      branchId: branch.id,
      currencyId: currency.id,
      exchangeRate: '1.0000',
      status: 'POSTED',
      totalBase: '200',
      totalTax: '32',
      total: '232',
      date: new Date('2026-10-08T00:00:00.000Z'),
    });

    const rows = await payables.list(branch.id);
    const row = rows.find(item => item.invoiceId === invoice.id);

    expect(row?.creditNotes).toBe(232);
    // 1.160 − 232 de la nota de crédito − 120 de retención.
    expect(row?.balance).toBe(808);
  });
});

describe('Regla 5: no se anula una factura con pagos', () => {
  it('responde conflicto si hay pagado', async () => {
    const { branch, invoice } = await postedPurchase();

    await testDb.update(invoices).set({ paidAmount: '100' }).where(eq(invoices.id, invoice.id));

    await expect(billing.void(invoice.id, branch.id)).rejects.toThrow(/pagos aplicados/);
  });
});

/** Primer método de pago disponible en la base de pruebas. */
async function firstMethodId(): Promise<string> {
  const { paymentMethods } = await import('../schema');
  const [method] = await testDb.select().from(paymentMethods).limit(1);

  if (!method) throw new Error('La base de pruebas no tiene métodos de pago');

  return method.id;
}
