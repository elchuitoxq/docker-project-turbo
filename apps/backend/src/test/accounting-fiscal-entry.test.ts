import { describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestCurrency,
  createTestPartner,
  createTestUser,
  ensureTestBaseCurrency,
} from './factories';
import {
  accountingAccounts,
  accountingEntries,
  accountingEntryLines,
  accountingMaps,
  bankAccounts,
  invoices,
  paymentMethods,
  payments,
} from '../schema';
import { BillingService } from '../modules/billing/services/billing.service';
import { AccountingService } from '../modules/accounting/accounting.service';

/**
 * Asiento fiscal de la factura y banco por cuenta contable (`S-19`).
 *
 * Reglas que se certifican:
 * 1. El asiento de una venta no lleva el IVA ni el IGTF a ingresos: cada impuesto va a su cuenta.
 * 2. El asiento de una compra acumula el IVA como crédito fiscal.
 * 3. El cobro/pago mueve la cuenta contable **de la cuenta bancaria**, no un banco genérico.
 * 4. Anular la factura anula su asiento.
 */
const CODES = {
  clientes: '1.1.2.001',
  ivaCredito: '1.1.2.002',
  ivaDebito: '2.1.1.002',
  igtf: '2.1.1.007',
  ingresos: '4.1.1.001',
  mercancia: '1.1.3.001',
  proveedores: '2.1.1.001',
  bancoFuncional: '1.1.1.002',
  bancoExtranjero: '1.1.1.003',
};

type AccountKey = keyof typeof CODES;

const LIABILITIES: AccountKey[] = ['ivaDebito', 'igtf', 'proveedores'];

/** Sufijo único: los archivos de prueba corren en paralelo sobre la misma base. */
function tag(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

/** Crea (o reutiliza) las cuentas del plan y los mapeos de factura. Los códigos son globales. */
async function seedLedger(): Promise<Record<AccountKey, string>> {
  const ids = {} as Record<AccountKey, string>;

  for (const [key, code] of Object.entries(CODES) as [AccountKey, string][]) {
    const [existing] = await testDb
      .select({ id: accountingAccounts.id })
      .from(accountingAccounts)
      .where(eq(accountingAccounts.code, code))
      .limit(1);

    if (existing) {
      ids[key] = existing.id;
      continue;
    }

    const [created] = await testDb
      .insert(accountingAccounts)
      .values({
        code,
        name: `Cuenta ${code}`,
        type: LIABILITIES.includes(key) ? 'LIABILITY' : key === 'ingresos' ? 'REVENUE' : 'ASSET',
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ id: accountingAccounts.id });

    // Otra prueba pudo crearla entre el `select` y el `insert`.
    ids[key] =
      created?.id ??
      (
        await testDb
          .select({ id: accountingAccounts.id })
          .from(accountingAccounts)
          .where(eq(accountingAccounts.code, code))
          .limit(1)
      )[0].id;
  }

  // Los mapas son globales por módulo: se reemplazan los de factura y cobro para que la prueba no
  // dependa de lo que hayan dejado otros archivos.
  await testDb.delete(accountingMaps).where(inArray(accountingMaps.module, ['INVOICE', 'PAYMENT']));
  await testDb.insert(accountingMaps).values([
    {
      module: 'INVOICE',
      transactionType: 'SALE',
      debitAccountId: ids.clientes,
      creditAccountId: ids.ingresos,
    },
    {
      module: 'INVOICE',
      transactionType: 'PURCHASE',
      debitAccountId: ids.mercancia,
      creditAccountId: ids.proveedores,
    },
    {
      module: 'PAYMENT',
      transactionType: 'INCOME',
      debitAccountId: ids.bancoFuncional,
      creditAccountId: ids.clientes,
    },
  ]);

  return ids;
}

/** Factura posteada por 1.000 + 160 de IVA, en moneda funcional (tasa 1). */
async function postedInvoice(type: 'SALE' | 'PURCHASE', extra: Record<string, string> = {}) {
  const branch = await createTestBranch();
  const user = await createTestUser();
  const partner = await createTestPartner({ type: type === 'SALE' ? 'CUSTOMER' : 'SUPPLIER' });
  const base = await ensureTestBaseCurrency();

  const [invoice] = await testDb
    .insert(invoices)
    .values({
      code: `S19-${type}-${tag()}`,
      type,
      partnerId: partner.id,
      branchId: branch.id,
      currencyId: base.id,
      exchangeRate: '1.0000000000',
      status: 'POSTED',
      totalBase: '1000.00',
      totalTax: '160.00',
      totalIgtf: '0.00',
      total: '1160.00',
      date: new Date(),
      userId: user.id,
      ...extra,
    })
    .returning();

  return { invoice, branch, user, partner, base };
}

async function linesOf(entryId: string) {
  const lines = await testDb
    .select()
    .from(accountingEntryLines)
    .where(eq(accountingEntryLines.entryId, entryId));

  return {
    lines,
    net: new Map(lines.map(line => [line.accountId, Number(line.debit) - Number(line.credit)])),
    debit: lines.reduce((sum, line) => sum + Number(line.debit), 0),
    credit: lines.reduce((sum, line) => sum + Number(line.credit), 0),
  };
}

describe('Asiento fiscal de la factura (S-19)', () => {
  const accounting = new AccountingService();

  it('separa base, IVA e IGTF y cuadra el asiento de una venta', async () => {
    const ids = await seedLedger();
    const { invoice, user } = await postedInvoice('SALE', {
      totalIgtf: '34.80',
      total: '1194.80',
    });

    const entry = await accounting.createEntryFromInvoice(invoice.id, user.id);
    const { net, debit, credit } = await linesOf(entry.id);

    expect(net.get(ids.clientes)).toBeCloseTo(1194.8, 2);
    expect(net.get(ids.ingresos)).toBeCloseTo(-1000, 2);
    expect(net.get(ids.ivaDebito)).toBeCloseTo(-160, 2);
    expect(net.get(ids.igtf)).toBeCloseTo(-34.8, 2);
    expect(debit).toBeCloseTo(credit, 2);
  });

  it('acumula el IVA de la compra como crédito fiscal', async () => {
    const ids = await seedLedger();
    const { invoice, user } = await postedInvoice('PURCHASE');

    const entry = await accounting.createEntryFromInvoice(invoice.id, user.id);
    const { net, debit, credit } = await linesOf(entry.id);

    expect(net.get(ids.mercancia)).toBeCloseTo(1000, 2);
    expect(net.get(ids.ivaCredito)).toBeCloseTo(160, 2);
    expect(net.get(ids.proveedores)).toBeCloseTo(-1160, 2);
    expect(debit).toBeCloseTo(credit, 2);
  });

  it('anular la factura anula el asiento', async () => {
    await seedLedger();
    const billing = new BillingService();
    const accounting = new AccountingService();
    const { invoice, branch, user } = await postedInvoice('SALE');

    await accounting.createEntryFromInvoice(invoice.id, user.id);
    await billing.void(invoice.id, branch.id, user.id, 'Prueba de anulación');

    const [entry] = await testDb
      .select()
      .from(accountingEntries)
      .where(eq(accountingEntries.sourceId, invoice.id));

    expect(entry.status).toBe('CANCELLED');
  });
});

describe('Banco por cuenta contable (S-19)', () => {
  const accounting = new AccountingService();

  it('usa la cuenta contable de la cuenta bancaria en el cobro', async () => {
    const ids = await seedLedger();
    const branch = await createTestBranch();
    const user = await createTestUser();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const usd = await createTestCurrency({ code: `U${tag()}` });

    const [account] = await testDb
      .insert(bankAccounts)
      .values({
        name: 'Banco en divisa',
        accountNumber: `ACC-${tag()}`,
        type: 'CHECKING',
        currencyId: usd.id,
        branchId: branch.id,
        initialBalance: '0',
        currentBalance: '0',
        accountingAccountId: ids.bancoExtranjero,
      })
      .returning();

    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: 'TRANSFER', name: 'Transferencia', branchId: branch.id })
      .returning();

    const [payment] = await testDb
      .insert(payments)
      .values({
        code: `PAY-S19-${tag()}`,
        partnerId: partner.id,
        branchId: branch.id,
        methodId: method.id,
        type: 'INCOME',
        status: 'POSTED',
        amount: '100.00',
        currencyId: usd.id,
        exchangeRate: '40.0000000000',
        amountBase: '4000.00',
        bankAccountId: account.id,
        date: new Date(),
        userId: user.id,
      })
      .returning();

    const entry = await accounting.createEntryFromPayment(payment.id, user.id);
    const { net } = await linesOf(entry.id);

    // La cuenta en divisa entra al banco en moneda extranjera, no al genérico de moneda funcional.
    expect(net.get(ids.bancoExtranjero)).toBeCloseTo(4000, 2);
    expect(net.get(ids.bancoFuncional)).toBeUndefined();
    expect(net.get(ids.clientes)).toBeCloseTo(-4000, 2);
  });
});
