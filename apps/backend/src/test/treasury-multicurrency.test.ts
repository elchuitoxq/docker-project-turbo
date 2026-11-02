import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestCurrency,
  createTestPartner,
  createTestProduct,
  createTestUser,
  ensureTestBaseCurrency,
} from './factories';
import {
  accountingAccounts,
  accountingEntries,
  accountingMaps,
  bankAccounts,
  exchangeRates,
  invoices,
  paymentAllocations,
  paymentMethods,
  payments,
} from '../schema';
import { BillingService } from '../modules/billing/services/billing.service';
import { TreasuryService } from '../modules/treasury/services/treasury.service';
import { MoneyService } from '../common/money/money.service';
import { CreateInvoiceDto, InvoiceType } from '../modules/billing/dto/billing.dto';

/** Sufijo único por llamada: evita colisiones entre archivos que corren en paralelo. */
function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

/**
 * Imputación multimoneda de cobros y pagos (`S-18`).
 *
 * Regla certificada: la cuenta manda la moneda del pago, y el saldo de la factura baja **en la
 * moneda del documento**. Misma moneda ⇒ rebaja a la par; monedas distintas ⇒ equivalente del día.
 * La diferencia entre la tasa del pago y la tasa congelada de la factura se guarda por imputación.
 */
describe('Tesorería multimoneda', () => {
  const billing = new BillingService();
  const treasury = new TreasuryService(new MoneyService());

  /** Método que afecta saldo: obliga a indicar cuenta bancaria y valida su moneda. */
  async function transferMethod(branchId: string): Promise<string> {
    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: 'TRANSFER', name: 'Transferencia', branchId })
      .returning();

    return method.id;
  }

  /** Método que no afecta saldo: permite probar la imputación sin cuenta bancaria. */
  async function retentionMethod(branchId: string): Promise<string> {
    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: `RET${uniqueSuffix()}`, name: 'Retención', branchId })
      .returning();

    return method.id;
  }

  async function bankAccount(branchId: string, currencyId: string): Promise<string> {
    const [account] = await testDb
      .insert(bankAccounts)
      .values({
        name: `Cuenta ${uniqueSuffix()}`,
        accountNumber: `ACC-${uniqueSuffix()}`,
        type: 'CHECKING',
        currencyId,
        branchId,
        initialBalance: '0',
        currentBalance: '0',
      })
      .returning();

    return account.id;
  }

  /**
   * Cuentas del plan + mapeo `PAYMENT/INCOME` para la sucursal: sin mapeo el servicio no contabiliza
   * y no habría asiento que anular al dar de baja el cobro.
   */
  async function seedPaymentMap(branchId: string, methodId: string): Promise<void> {
    const [debit] = await testDb
      .insert(accountingAccounts)
      .values({ code: `1.1.1.${uniqueSuffix()}`, name: 'Banco', type: 'ASSET', branchId })
      .returning();
    const [credit] = await testDb
      .insert(accountingAccounts)
      .values({ code: `1.1.2.${uniqueSuffix()}`, name: 'Clientes', type: 'ASSET', branchId })
      .returning();

    // La cuenta de resultado cambiario es única por código y el asiento de cobro la necesita para
    // registrar la diferencia cambiaria sin descuadrar la partida doble.
    const [fx] = await testDb
      .select()
      .from(accountingAccounts)
      .where(eq(accountingAccounts.code, '6.1.3.001'))
      .limit(1);

    if (!fx) {
      await testDb.insert(accountingAccounts).values({
        code: '6.1.3.001',
        name: 'Gasto por diferencia cambiaria',
        type: 'EXPENSE',
        branchId,
      });
    }

    await testDb.insert(accountingMaps).values({
      branchId,
      module: 'PAYMENT',
      transactionType: 'INCOME',
      paymentMethodId: methodId,
      debitAccountId: debit.id,
      creditAccountId: credit.id,
    });
  }

  /**
   * Factura de venta en divisa por 100 + IGTF 3 % = 103, con la tasa congelada en 40.
   *
   * La tasa del día queda en 42 después de emitir: así el cobro se valora a 42 y la diferencia
   * contra los 40 de la factura tiene que aparecer como resultado cambiario.
   */
  async function foreignInvoice() {
    const branch = await createTestBranch();
    const user = await createTestUser();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct();
    const currency = await createTestCurrency({ code: `U${uniqueSuffix()}` });
    const base = await ensureTestBaseCurrency();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [rateRow] = await testDb
      .insert(exchangeRates)
      .values({ currencyId: currency.id, rate: '40', date: today, source: 'BCV' })
      .returning();

    const dto = {
      partnerId: partner.id,
      branchId: branch.id,
      currencyId: currency.id,
      type: InvoiceType.SALE,
      items: [{ productId: product.id, quantity: 1, price: 100, taxRate: 0 }],
    } as CreateInvoiceDto;

    const invoice = await billing.create(dto, user.id, branch.id);

    // El cobro se registra con la tasa vigente del día (42), no con la congelada en la factura.
    await testDb.update(exchangeRates).set({ rate: '42' }).where(eq(exchangeRates.id, rateRow.id));

    return { invoice, dto, partner, branch, user, currency, base };
  }

  async function reloadInvoice(id: string) {
    const [row] = await testDb.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return row;
  }

  it('cobra una factura en divisa desde la moneda funcional y registra la diferencia cambiaria', async () => {
    const { invoice, partner, branch, user, base } = await foreignInvoice();
    const methodId = await retentionMethod(branch.id);

    // 103 USD × 42 = 4.326 Bs; la factura está congelada a 40, así que la ganancia es 206 Bs.
    const payment = await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId,
        type: 'INCOME' as never,
        amount: 4326,
        currencyId: base.id,
        exchangeRate: 1,
        invoiceId: invoice.id,
      } as never,
      user.id,
      branch.id
    );

    const updated = await reloadInvoice(invoice.id);
    const [allocation] = await testDb
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, payment.id));

    expect(Number(invoice.total)).toBeCloseTo(103, 2);
    expect(Number(allocation.invoiceAmount)).toBeCloseTo(103, 2);
    expect(Number(allocation.amountBase)).toBeCloseTo(4326, 2);
    expect(Number(allocation.exchangeDifferenceBase)).toBeCloseTo(206, 2);
    expect(Number(updated.paidAmount)).toBeCloseTo(103, 2);
    expect(Number(updated.total) - Number(updated.paidAmount)).toBeCloseTo(0, 2);
    expect(updated.status).toBe('PAID');

    const [stored] = await testDb.select().from(payments).where(eq(payments.id, payment.id));
    const metadata = stored.metadata as { exchangeDifference?: number } | null;
    expect(metadata?.exchangeDifference).toBeCloseTo(206, 2);
  });

  it('cobra en la misma divisa de la factura y rebaja a la par aunque la tasa haya cambiado', async () => {
    const { invoice, partner, branch, user, currency } = await foreignInvoice();
    const methodId = await retentionMethod(branch.id);

    const payment = await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId,
        type: 'INCOME' as never,
        amount: 103,
        currencyId: currency.id,
        exchangeRate: 42,
        invoiceId: invoice.id,
      } as never,
      user.id,
      branch.id
    );

    const updated = await reloadInvoice(invoice.id);
    const [allocation] = await testDb
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, payment.id));

    // Par: pagar 103 USD rebaja 103 USD, no 103 × 42 / 40.
    expect(Number(allocation.invoiceAmount)).toBeCloseTo(103, 2);
    expect(Number(allocation.exchangeDifferenceBase)).toBeCloseTo(206, 2);
    expect(updated.status).toBe('PAID');
    expect(Number(updated.paidAmount)).toBeCloseTo(103, 2);
  });

  it('rechaza un cobro en divisa sobre una cuenta en bolívares', async () => {
    const { invoice, partner, branch, user, currency, base } = await foreignInvoice();
    const methodId = await transferMethod(branch.id);
    const vesAccountId = await bankAccount(branch.id, base.id);

    await expect(
      treasury.create(
        {
          partnerId: partner.id,
          branchId: branch.id,
          methodId,
          type: 'INCOME' as never,
          amount: 10,
          currencyId: currency.id,
          exchangeRate: 42,
          bankAccountId: vesAccountId,
          invoiceId: invoice.id,
        } as never,
        user.id,
        branch.id
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('exige la cuenta bancaria cuando el método afecta el saldo', async () => {
    const { invoice, partner, branch, user, base } = await foreignInvoice();
    const methodId = await transferMethod(branch.id);

    await expect(
      treasury.create(
        {
          partnerId: partner.id,
          branchId: branch.id,
          methodId,
          type: 'INCOME' as never,
          amount: 100,
          currencyId: base.id,
          exchangeRate: 1,
          invoiceId: invoice.id,
        } as never,
        user.id,
        branch.id
      )
    ).rejects.toThrow(/cuenta bancaria/i);
  });

  it('mueve el saldo de la cuenta en su propia moneda', async () => {
    const { invoice, partner, branch, user, currency } = await foreignInvoice();
    const methodId = await transferMethod(branch.id);
    const usdAccountId = await bankAccount(branch.id, currency.id);

    await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId,
        type: 'INCOME' as never,
        amount: 103,
        currencyId: currency.id,
        exchangeRate: 42,
        bankAccountId: usdAccountId,
        invoiceId: invoice.id,
      } as never,
      user.id,
      branch.id
    );

    const [account] = await testDb
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, usdAccountId));

    // La cuenta es en dólares: entran 103 USD, no 103 × 42 Bs.
    expect(Number(account.currentBalance)).toBeCloseTo(103, 2);
  });

  it('rechaza imputar más de lo que resta la factura', async () => {
    const { invoice, partner, branch, user, currency } = await foreignInvoice();
    const methodId = await retentionMethod(branch.id);

    await expect(
      treasury.create(
        {
          partnerId: partner.id,
          branchId: branch.id,
          methodId,
          type: 'INCOME' as never,
          amount: 200,
          currencyId: currency.id,
          exchangeRate: 42,
          invoiceId: invoice.id,
        } as never,
        user.id,
        branch.id
      )
    ).rejects.toThrow(/supera el saldo/i);
  });

  it('anular el cobro devuelve el saldo a la factura y anula su asiento', async () => {
    const { invoice, partner, branch, user, currency } = await foreignInvoice();
    const methodId = await retentionMethod(branch.id);

    await seedPaymentMap(branch.id, methodId);

    const payment = await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId,
        type: 'INCOME' as never,
        amount: 103,
        currencyId: currency.id,
        exchangeRate: 42,
        invoiceId: invoice.id,
      } as never,
      user.id,
      branch.id
    );

    expect((await reloadInvoice(invoice.id)).status).toBe('PAID');

    const entryBefore = await testDb
      .select()
      .from(accountingEntries)
      .where(eq(accountingEntries.sourceId, payment.id));
    expect(entryBefore).toHaveLength(1);
    expect(entryBefore[0].status).toBe('POSTED');

    await treasury.voidPayment(payment.id, user.id, branch.id);

    const reverted = await reloadInvoice(invoice.id);
    expect(reverted.status).toBe('POSTED');
    expect(Number(reverted.paidAmount)).toBeCloseTo(0, 2);

    const remaining = await testDb
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, payment.id));
    expect(remaining).toHaveLength(0);

    // El asiento no puede seguir sumando en el mayor: se marca `CANCELLED` y se conserva la traza.
    const entryAfter = await testDb
      .select()
      .from(accountingEntries)
      .where(eq(accountingEntries.sourceId, payment.id));
    expect(entryAfter[0].status).toBe('CANCELLED');
  });
});
