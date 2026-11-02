import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { testDb } from './database';
import {
  createTestBranch,
  createTestCurrency,
  createTestInvoice,
  createTestInvoiceItem,
  createTestOrder,
  createTestOrderItem,
  createTestPartner,
  createTestProduct,
  createTestUser,
  ensureTestBaseCurrency,
} from './factories';
import { exchangeRates, invoices, paymentMethods } from '../schema';
import { BillingService } from '../modules/billing/services/billing.service';
import { OrdersService } from '../modules/orders/orders.service';
import { TreasuryService } from '../modules/treasury/services/treasury.service';
import { MoneyService } from '../common/money/money.service';

/**
 * Ficha de documentos (`S-10`, `T-10-01` y `T-10-02`) contra Postgres real.
 *
 * Lo que se verifica es lo que la UI necesita y el listado no trae: nombres de producto, moneda, partes
 * relacionadas y saldo en la moneda del documento.
 */
const billing = new BillingService();
const orders = new OrdersService();
const treasury = new TreasuryService(new MoneyService());

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

describe('Ficha de documento', () => {
  it('la factura trae moneda, autor, nombres de producto y saldo', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser({ name: 'Autora de Factura' });
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct({ sku: `SKU-${uniqueSuffix()}`, name: 'Cable HDMI' });
    const base = await ensureTestBaseCurrency();

    const invoice = await createTestInvoice(partner.id, branch.id, base.id, {
      userId: user.id,
      status: 'POSTED',
      totalBase: '100',
      totalTax: '16',
      total: '116',
      type: 'SALE',
    });
    await createTestInvoiceItem(invoice.id, product.id, {
      quantity: '1.0000',
      price: '100.00',
      taxRate: '16.00',
      total: '100.00',
    });

    const detail = await billing.findOne(invoice.id, branch.id);

    expect(detail.currencyCode).toBe(base.code);
    expect(detail.branchName).toBe(branch.name);
    expect(detail.createdByName).toBe('Autora de Factura');
    expect(detail.items?.[0]).toMatchObject({
      productName: 'Cable HDMI',
      productSku: product.sku,
    });
    expect(detail.settlement).toMatchObject({ total: 116, paid: 0, balance: 116 });
    expect(detail.payments).toEqual([]);
    expect(detail.daysOverdue).toBe(0);
  });

  it('el saldo de una factura en divisa se expresa en su moneda y lista los pagos aplicados', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const base = await ensureTestBaseCurrency();
    const usd = await createTestCurrency({ code: `U${uniqueSuffix()}` });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await testDb
      .insert(exchangeRates)
      .values({ currencyId: usd.id, rate: '40', date: today, source: 'BCV' });

    // Factura de 100 USD a tasa 40 (400 VES) y pago de 200 VES: medio saldo en dólares.
    const invoice = await createTestInvoice(partner.id, branch.id, usd.id, {
      userId: user.id,
      status: 'POSTED',
      exchangeRate: '40.0000000000',
      totalBase: '100',
      totalTax: '0',
      total: '100',
    });

    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: `CASH${uniqueSuffix()}`, name: 'Efectivo' })
      .returning();

    await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId: method.id,
        type: 'INCOME' as never,
        amount: 200,
        currencyId: base.id,
        // Pago en moneda funcional: la tasa del pago es 1 (la del documento es la que convierte).
        exchangeRate: 1,
        allocations: [{ invoiceId: invoice.id, amount: 200 }],
      } as never,
      user.id
    );

    const detail = await billing.findOne(invoice.id, branch.id);

    expect(detail.currencyCode).toBe(usd.code);
    expect(detail.exchangeRate).toBe(40);
    expect(detail.settlement?.paid).toBe(5);
    expect(detail.settlement?.balance).toBe(95);
    expect(detail.payments?.[0]).toMatchObject({ currencyCode: base.code, amount: 200 });
  });

  it('el pedido trae tercero, almacén, SKU y la factura que generó', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser({ name: 'Vendedor de Pedidos' });
    const partner = await createTestPartner({
      type: 'CUSTOMER',
      taxId: `J-${faker.string.numeric(8)}-${faker.string.numeric(1)}`,
    });
    const product = await createTestProduct({ name: 'Monitor 24"' });
    const base = await ensureTestBaseCurrency();

    const order = await createTestOrder(partner.id, branch.id, {
      userId: user.id,
      currencyId: base.id,
      status: 'COMPLETED',
      total: '150',
    });
    await createTestOrderItem(order.id, product.id);

    const invoice = await createTestInvoice(partner.id, branch.id, base.id, {
      orderId: order.id,
      status: 'POSTED',
      total: '150',
    });

    const detail = await orders.findOne(order.id, branch.id);

    expect(detail.partnerName).toBe(partner.name);
    expect(detail.partnerTaxId).toBe(partner.taxId);
    expect(detail.currencyCode).toBe(base.code);
    expect(detail.createdByName).toBe('Vendedor de Pedidos');
    expect(detail.items?.[0]).toMatchObject({
      productName: 'Monitor 24"',
      productSku: product.sku,
    });
    expect(detail.invoiceCode).toBe(invoice.code);
    expect(detail.invoiceStatus).toBe('POSTED');
  });

  it('un pedido de otra sucursal responde 404 aunque exista', async () => {
    const branch = await createTestBranch();
    const other = await createTestBranch();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const order = await createTestOrder(partner.id, branch.id);

    await expect(orders.findOne(order.id, other.id)).rejects.toThrow(/not found/i);
  });

  it('facturar un pedido crea la factura con su moneda y tasa, y no permite facturarlo dos veces', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct();
    const base = await ensureTestBaseCurrency();

    const order = await createTestOrder(partner.id, branch.id, {
      userId: user.id,
      currencyId: base.id,
      status: 'CONFIRMED',
      total: '300',
      exchangeRate: '1.0000',
    });
    await createTestOrderItem(order.id, product.id, {
      quantity: '2.0000',
      price: '150.00',
    });

    const result = await orders.invoice(order.id, branch.id, user.id);

    expect(result.invoiceCode).toBeTruthy();
    const detail = await billing.findOne(result.invoiceId, branch.id);
    expect(detail).toMatchObject({
      type: 'SALE',
      currencyCode: base.code,
      totalBase: 300,
      orderCode: order.code,
    });

    const [stored] = await testDb.select().from(invoices).where(eq(invoices.id, result.invoiceId));
    expect(stored.orderId).toBe(order.id);

    const reloaded = await orders.findOne(order.id, branch.id);
    expect(reloaded.status).toBe('COMPLETED');

    await expect(orders.invoice(order.id, branch.id, user.id)).rejects.toThrow(
      /ya tiene una factura/i
    );
  });

  it('la factura de otra sucursal responde 404 aunque exista', async () => {
    const branch = await createTestBranch();
    const other = await createTestBranch();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const base = await ensureTestBaseCurrency();
    const invoice = await createTestInvoice(partner.id, branch.id, base.id);

    await expect(billing.findOne(invoice.id, other.id)).rejects.toThrow(/not found/i);
  });
});
