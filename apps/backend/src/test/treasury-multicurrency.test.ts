import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestCurrency,
  createTestPartner,
  createTestProduct,
  createTestUser,
} from './factories';
import { accountsBankStatementsPlaceholder } from './__placeholder';
import { currencies, exchangeRates, invoices, paymentMethods, payments } from '../schema';
import { BillingService } from '../modules/billing/services/billing.service';
import { TreasuryService } from '../modules/treasury/services/treasury.service';
import { MoneyService } from '../common/money/money.service';
import { CreateInvoiceDto, InvoiceType } from '../modules/billing/dto/billing.dto';

/** Sufijo único por llamada: evita colisiones entre archivos que corren en paralelo. */
function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

describe('Tesoreria multimoneda', () => {
  const money = new MoneyService();
  const billing = new BillingService();
  const treasury = new TreasuryService(money);

  async function baseCurrency() {
    const [base] = await testDb
      .select({ id: currencies.id, code: currencies.code })
      .from(currencies)
      .where(eq(currencies.isBase, true))
      .limit(1);
    if (!base) throw new Error('No base currency configured');
    return base;
  }

  async function paymentMethodId(): Promise<string> {
    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: `CASH${uniqueSuffix()}`, name: 'Efectivo' })
      .returning();
    return method.id;
  }

  async function usdInvoice() {
    const branch = await createTestBranch();
    const user = await createTestUser();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct();
    const usd = await createTestCurrency({ code: `U${uniqueSuffix()}` });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await testDb
      .insert(exchangeRates)
      .values({ currencyId: usd.id, rate: '40', date: today, source: 'BCV' });

    const dto = {
      partnerId: partner.id,
      branchId: branch.id,
      currencyId: usd.id,
      type: InvoiceType.SALE,
      items: [{ productId: product.id, quantity: 1, price: 100, taxRate: 0 }],
    } as CreateInvoiceDto;

    const invoice = await billing.create(dto, user.id, branch.id);
    await testDb.update(invoices).set({ status: 'POSTED' }).where(eq(invoices.id, invoice.id));

    return { invoice, partner, branch, user, usd, base: await baseCurrency() };
  }

  it('cobra en moneda funcional una factura en divisa y registra la diferencia cambiaria', async () => {
    const { invoice, partner, branch, user, base } = await usdInvoice();
    const methodId = await paymentMethodId();

    // Factura: 100 USD + IGTF 3% = 103 USD a tasa 40 => 4.120 VES en el libro. Se cobra 4.200.
    const payment = await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId,
        type: 'INCOME' as never,
        amount: 4200,
        currencyId: base.id,
        exchangeRate: 1,
        invoiceId: invoice.id,
      } as never,
      user.id,
      branch.id
    );

    const [updatedInvoice] = await testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
      .limit(1);
    const [storedPayment] = await testDb
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);

    expect(updatedInvoice.status).toBe('PAID');
    expect(Number(storedPayment.amountBase)).toBe(4200);

    const metadata = storedPayment.metadata as { exchangeDifference?: number } | null;
    expect(metadata?.exchangeDifference).toBeCloseTo(80, 2);
  });

  it('no marca la factura como pagada si el cobro en moneda funcional no alcanza', async () => {
    const { invoice, partner, branch, user, base } = await usdInvoice();
    const methodId = await paymentMethodId();

    await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId,
        type: 'INCOME' as never,
        amount: 1000,
        currencyId: base.id,
        exchangeRate: 1,
        invoiceId: invoice.id,
      } as never,
      user.id,
      branch.id
    );

    const [updatedInvoice] = await testDb
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
      .limit(1);

    expect(updatedInvoice.status).not.toBe('PAID');
  });
});
