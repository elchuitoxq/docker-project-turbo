import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestPartner,
  createTestProduct,
  ensureTestBaseCurrency,
  ensureTestUser,
} from './factories';
import { invoices, paymentMethods, payments } from '../schema';
import { BillingService } from '../modules/billing/services/billing.service';
import { TreasuryService } from '../modules/treasury/services/treasury.service';
import { MoneyService } from '../common/money/money.service';
import { CreateInvoiceDto, InvoiceType } from '../modules/billing/dto/billing.dto';

/** Sufijo único por llamada: evita colisiones entre archivos que corren en paralelo. */
function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

/**
 * Referencia bancaria de los cobros/pagos (`T-05-01`).
 *
 * Una misma transferencia no puede justificar dos cobros: ni dos abonos de la misma factura ni
 * cobros de facturas distintas. Además el método puede exigir la referencia y un pago anulado la
 * libera porque el dinero no llegó a la cuenta.
 */
describe('Referencia bancaria de los pagos', () => {
  const billing = new BillingService();
  const treasury = new TreasuryService(new MoneyService());

  async function sale(amount = 100) {
    const branch = await createTestBranch();
    const user = await ensureTestUser();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct();
    const base = await ensureTestBaseCurrency();

    const invoice = await billing.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        currencyId: base.id,
        type: InvoiceType.SALE,
        items: [{ productId: product.id, quantity: 1, price: amount, taxRate: 0 }],
      } as CreateInvoiceDto,
      user.id,
      branch.id
    );

    return { invoice, branch, user, partner, base };
  }

  /** Método que no afecta saldo: la prueba se centra en la referencia, no en la cuenta bancaria. */
  async function method(branchId: string, extra: Partial<typeof paymentMethods.$inferInsert> = {}) {
    const [row] = await testDb
      .insert(paymentMethods)
      .values({ code: `REF${uniqueSuffix()}`, name: 'Transferencia', branchId, ...extra })
      .returning();

    return row;
  }

  async function pay(input: {
    invoiceId: string;
    partnerId: string;
    branchId: string;
    userId: string;
    methodId: string;
    currencyId: string;
    amount: number;
    reference?: string;
  }) {
    return treasury.create(
      {
        partnerId: input.partnerId,
        branchId: input.branchId,
        methodId: input.methodId,
        invoiceId: input.invoiceId,
        type: 'INCOME' as never,
        amount: input.amount,
        currencyId: input.currencyId,
        exchangeRate: 1,
        ...(input.reference === undefined ? {} : { reference: input.reference }),
      } as never,
      input.userId,
      input.branchId
    );
  }

  async function reloadInvoice(id: string) {
    const [row] = await testDb.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return row;
  }

  it('registra abonos parciales y baja el saldo de la factura de a poco', async () => {
    const { invoice, branch, user, partner, base } = await sale(100);
    const methodRow = await method(branch.id);
    const common = {
      invoiceId: invoice.id,
      partnerId: partner.id,
      branchId: branch.id,
      userId: user.id,
      methodId: methodRow.id,
      currencyId: base.id,
    };

    await pay({ ...common, amount: 40, reference: `ABONO-${uniqueSuffix()}` });
    let current = await reloadInvoice(invoice.id);
    expect(Number(current.paidAmount)).toBeCloseTo(40, 2);
    expect(current.status).toBe('PARTIAL');

    await pay({ ...common, amount: 60, reference: `ABONO-${uniqueSuffix()}` });
    current = await reloadInvoice(invoice.id);
    expect(Number(current.paidAmount)).toBeCloseTo(100, 2);
    expect(current.status).toBe('PAID');
  });

  it('rechaza la misma referencia en otro abono de la misma factura', async () => {
    const { invoice, branch, user, partner, base } = await sale(100);
    const methodRow = await method(branch.id);
    const common = {
      invoiceId: invoice.id,
      partnerId: partner.id,
      branchId: branch.id,
      userId: user.id,
      methodId: methodRow.id,
      currencyId: base.id,
    };

    const reference = `ZELLE-${uniqueSuffix()}`;
    await pay({ ...common, amount: 40, reference });

    // La normalización hace que « zelle-… » sea la misma transferencia.
    await expect(
      pay({ ...common, amount: 10, reference: ` ${reference.toLowerCase()} ` })
    ).rejects.toThrow(ConflictException);

    const current = await reloadInvoice(invoice.id);
    expect(Number(current.paidAmount)).toBeCloseTo(40, 2);
  });

  it('rechaza la misma referencia en una factura distinta', async () => {
    const first = await sale(100);
    const second = await sale(100);
    const methodRow = await method(first.branch.id);
    const reference = `TRANSFER-${uniqueSuffix()}`;

    await pay({
      invoiceId: first.invoice.id,
      partnerId: first.partner.id,
      branchId: first.branch.id,
      userId: first.user.id,
      methodId: methodRow.id,
      currencyId: first.base.id,
      amount: 100,
      reference,
    });

    await expect(
      pay({
        invoiceId: second.invoice.id,
        partnerId: second.partner.id,
        branchId: second.branch.id,
        userId: second.user.id,
        methodId: methodRow.id,
        currencyId: second.base.id,
        amount: 100,
        reference,
      })
    ).rejects.toThrow(ConflictException);
  });

  it('libera la referencia cuando el pago se anula', async () => {
    const { invoice, branch, user, partner, base } = await sale(100);
    const methodRow = await method(branch.id);
    const reference = `CHEQUE-${uniqueSuffix()}`;
    const common = {
      invoiceId: invoice.id,
      partnerId: partner.id,
      branchId: branch.id,
      userId: user.id,
      methodId: methodRow.id,
      currencyId: base.id,
    };

    const payment = await pay({ ...common, amount: 100, reference });
    await treasury.voidPayment(payment.id, user.id, branch.id);

    // El dinero no llegó: la referencia se puede volver a usar en el cobro correcto.
    await expect(pay({ ...common, amount: 100, reference })).resolves.toBeTruthy();
  });

  it('exige la referencia cuando el método lo indica', async () => {
    const { invoice, branch, user, partner, base } = await sale(100);
    const methodRow = await method(branch.id, { requiresReference: true });

    await expect(
      pay({
        invoiceId: invoice.id,
        partnerId: partner.id,
        branchId: branch.id,
        userId: user.id,
        methodId: methodRow.id,
        currencyId: base.id,
        amount: 100,
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('la base rechaza dos pagos vigentes con la misma referencia', async () => {
    const branch = await createTestBranch();
    const user = await ensureTestUser();
    const partner = await createTestPartner();
    const base = await ensureTestBaseCurrency();
    const methodRow = await method(branch.id);
    const reference = `BASE-${uniqueSuffix()}`;

    const row = {
      partnerId: partner.id,
      branchId: branch.id,
      methodId: methodRow.id,
      amount: '10',
      currencyId: base.id,
      exchangeRate: '1',
      amountBase: '10',
      reference,
      userId: user.id,
    };

    await testDb.insert(payments).values({ ...row, code: `PAY-A-${uniqueSuffix()}` });

    await expect(
      testDb.insert(payments).values({ ...row, code: `PAY-B-${uniqueSuffix()}` })
    ).rejects.toThrow();

    // Anulado el primero, la referencia queda libre porque el dinero no llegó.
    await testDb.update(payments).set({ status: 'VOID' }).where(eq(payments.reference, reference));

    await expect(
      testDb.insert(payments).values({ ...row, code: `PAY-C-${uniqueSuffix()}` })
    ).resolves.toBeTruthy();
  });
});
