import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { testDb } from './database';
import { createTestBranch, createTestCurrency, createTestPartner } from './factories';
import {
  bankAccounts,
  bankStatementLines,
  dailyCloses,
  paymentMethods,
  payments,
  pettyCashFunds,
} from '../schema';
import { DailyCloseService } from '../modules/treasury/operations/daily-close.service';
import { ReconciliationService } from '../modules/treasury/operations/reconciliation.service';
import { PettyCashService } from '../modules/treasury/operations/petty-cash.service';
import { TreasuryService } from '../modules/treasury/services/treasury.service';
import { MoneyService } from '../common/money/money.service';

/**
 * Tesorería operativa (`T-05-01` … `T-05-07`) contra Postgres real.
 *
 * El caso central es el del spec: se cierra el día, un pago con esa fecha recibe `409`, se reabre con
 * motivo y el pago vuelve a entrar.
 */

const dailyClose = new DailyCloseService();
const reconciliation = new ReconciliationService(dailyClose);
const pettyCash = new PettyCashService(dailyClose);
const treasury = new TreasuryService(new MoneyService(), dailyClose);

const TODAY = new Date().toISOString().slice(0, 10);

async function branchWithMethod() {
  const branch = await createTestBranch();
  const currency = await createTestCurrency({ name: 'Divisa tesorería' });
  const [method] = await testDb
    .insert(paymentMethods)
    .values({
      name: 'Efectivo prueba',
      code: `CASH${faker.string.alphanumeric({ length: 5, casing: 'upper' })}`,
      branchId: branch.id,
      currencyId: currency.id,
      isCash: true,
    })
    .returning();

  return { branch, currency, method };
}

describe('Métodos de pago (T-05-01)', () => {
  it('un método desactivado no aparece al cobrar', async () => {
    const { branch, method } = await branchWithMethod();

    expect((await treasury.getMethods(branch.id)).map(m => m.id)).toContain(method.id);

    await treasury.updateMethod(method.id, { isActive: false });

    expect((await treasury.getMethods(branch.id)).map(m => m.id)).not.toContain(method.id);
    expect((await treasury.getAllMethods(branch.id)).map(m => m.id)).toContain(method.id);
  });

  it('persiste las banderas del método', async () => {
    const { method } = await branchWithMethod();

    const updated = await treasury.updateMethod(method.id, {
      appliesIgtf: true,
      requiresReference: true,
    });

    expect(updated.appliesIgtf).toBe(true);
    expect(updated.requiresReference).toBe(true);
  });
});

describe('Cuentas bancarias (T-05-02)', () => {
  it('guarda saldo inicial y permite editar', async () => {
    const { branch, currency } = await branchWithMethod();

    const account = await treasury.createBankAccount({
      name: 'Cuenta operativa',
      accountNumber: '0134-0000',
      type: 'CHECKING',
      currencyId: currency.id,
      branchId: branch.id,
      initialBalance: 1_000,
    });

    expect(account.initialBalance).toBe(1_000);
    expect(account.currentBalance).toBe(1_000);

    const updated = await treasury.updateBankAccount(account.id, branch.id, { notes: 'Caja 1' });

    expect(updated.notes).toBe('Caja 1');
  });
});

describe('Cierre diario (T-05-03)', () => {
  it('cierra, bloquea el pago del día y permite reabrir', async () => {
    const { branch, currency, method } = await branchWithMethod();
    const partner = await createTestPartner({ type: 'CUSTOMER' });

    const paymentDto = {
      partnerId: partner.id,
      branchId: branch.id,
      methodId: method.id,
      amount: 100,
      currencyId: currency.id,
      exchangeRate: 1,
      type: 'INCOME' as never,
      date: new Date(`${TODAY}T12:00:00.000Z`),
    };

    await treasury.create(paymentDto as never, faker.string.uuid());

    const closed = await dailyClose.close(branch.id, TODAY, faker.string.uuid(), {
      notes: 'Cierre de prueba',
    });

    expect(closed.status).toBe('CLOSED');
    expect(closed.totalIncome).toBeGreaterThanOrEqual(100);
    expect(closed.byCurrency.length).toBeGreaterThan(0);

    await expect(treasury.create(paymentDto as never, faker.string.uuid())).rejects.toThrow(
      /está cerrado/
    );

    await expect(dailyClose.close(branch.id, TODAY, faker.string.uuid())).rejects.toThrow(
      /ya está cerrado/
    );

    const reopened = await dailyClose.reopen(
      branch.id,
      TODAY,
      faker.string.uuid(),
      'Faltó registrar un cobro'
    );

    expect(reopened.status).toBe('OPEN');
    expect(reopened.reopenReason).toContain('Faltó');

    await expect(treasury.create(paymentDto as never, faker.string.uuid())).resolves.toBeDefined();
  });

  it('exige motivo para reabrir', async () => {
    const { branch } = await branchWithMethod();

    await dailyClose.close(branch.id, TODAY, null, {});

    await expect(dailyClose.reopen(branch.id, TODAY, null, '  ')).rejects.toThrow(/motivo/);
  });

  it('el snapshot no cambia si se cierra y se vuelve a leer', async () => {
    const { branch, currency, method } = await branchWithMethod();
    const partner = await createTestPartner({ type: 'CUSTOMER' });

    await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId: method.id,
        amount: 250,
        currencyId: currency.id,
        exchangeRate: 1,
        type: 'INCOME' as never,
        date: new Date(`${TODAY}T09:00:00.000Z`),
      } as never,
      faker.string.uuid()
    );

    const closed = await dailyClose.close(branch.id, TODAY, null, {
      cashCount: 250,
      openingCash: 0,
    });
    expect(closed.difference).toBe(0);
    expect(closed.expectedCash).toBe(250);
    // `amountBase` es la unidad de los agregados: con tasa 1 coincide con el importe del pago.

    // Un pago insertado por fuera no altera el snapshot del cierre.
    await testDb.insert(payments).values({
      code: `PAY-${faker.string.numeric(8)}`,
      partnerId: partner.id,
      branchId: branch.id,
      methodId: method.id,
      status: 'POSTED',
      type: 'INCOME',
      direction: 'IN',
      amount: '999',
      currencyId: currency.id,
      exchangeRate: '1',
      amountBase: '999',
      date: new Date(`${TODAY}T18:00:00.000Z`),
    });

    const reread = await dailyClose.summary(branch.id, TODAY);
    expect(reread.status).toBe('CLOSED');
    expect(reread.totalIncome).toBe(closed.totalIncome);
  });
});

describe('Conciliación bancaria (T-05-04, T-05-05)', () => {
  async function accountWithPayment() {
    const { branch, currency, method } = await branchWithMethod();
    const partner = await createTestPartner({ type: 'CUSTOMER' });

    const [account] = await testDb
      .insert(bankAccounts)
      .values({
        name: 'Banesco',
        accountNumber: `0134-${faker.string.numeric(8)}`,
        type: 'CHECKING',
        currencyId: currency.id,
        branchId: branch.id,
      })
      .returning();

    const payment = await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId: method.id,
        amount: 500,
        currencyId: currency.id,
        exchangeRate: 1,
        type: 'INCOME' as never,
        bankAccountId: account.id,
        date: new Date(`${TODAY}T10:00:00.000Z`),
      } as never,
      faker.string.uuid()
    );

    return { branch, account, payment, currency };
  }

  it('importa el CSV y no duplica si se repite el archivo', async () => {
    const { branch, account } = await accountWithPayment();
    const csv = `${TODAY},500.00,TRF-001,Cobro cliente\n${TODAY},-120.00,CHQ-9,Proveedor`;

    const first = await reconciliation.importCsv(branch.id, null, {
      bankAccountId: account.id,
      fileName: 'extracto.csv',
      content: csv,
    });

    expect(first.linesCount).toBe(2);
    expect(first.duplicated).toBe(false);

    const second = await reconciliation.importCsv(branch.id, null, {
      bankAccountId: account.id,
      fileName: 'extracto.csv',
      content: csv,
    });

    expect(second.duplicated).toBe(true);
    expect(second.importId).toBe(first.importId);
  });

  it('interpreta importes en formato inglés y español (H-93)', async () => {
    const rows = reconciliation.parseCsv(
      '2026-10-01,500.00,TRF-1,Inglés\n2026-10-02,"1.234,56",TRF-2,Español\n2026-10-03,-120,CHQ-9,Egreso'
    );

    expect(rows[0].amount).toBe(500);
    expect(rows[1].amount).toBe(1234.56);
    expect(rows[2].amount).toBe(-120);
  });

  it('rechaza un CSV inválido sin dejar líneas a medias', async () => {
    const { branch, account } = await accountWithPayment();

    await expect(
      reconciliation.importCsv(branch.id, null, {
        bankAccountId: account.id,
        content: `${TODAY},500.00,TRF-001,Ok\nno-es-fecha,abc,,`,
      })
    ).rejects.toThrow(/inválida/);

    const lines = await testDb
      .select()
      .from(bankStatementLines)
      .where(eq(bankStatementLines.bankAccountId, account.id));

    expect(lines).toHaveLength(0);
  });

  it('concilia la línea con el pago y no permite conciliar dos veces', async () => {
    const { branch, account, payment } = await accountWithPayment();

    const imported = await reconciliation.importCsv(branch.id, null, {
      bankAccountId: account.id,
      content: `${TODAY},500.00,TRF-001,Cobro cliente`,
    });

    const report = await reconciliation.report(branch.id, account.id);
    const line = report.lines.find(item => item.id !== undefined);

    expect(report.totalLines).toBe(1);
    expect(line?.suggestions?.[0]?.paymentId).toBe(payment.id);

    const matched = await reconciliation.match(branch.id, line!.id, payment.id, null);
    expect(matched.matched).toBe(true);

    await expect(
      reconciliation.match(branch.id, line!.id, payment.id, null)
    ).resolves.toBeDefined();

    const [storedPayment] = await testDb.select().from(payments).where(eq(payments.id, payment.id));

    expect(storedPayment.bankStatementLineId).toBe(line!.id);
    expect(imported.linesCount).toBe(1);

    const unmatched = await reconciliation.unmatch(branch.id, line!.id);
    expect(unmatched.matched).toBe(false);
  });
});

describe('Caja chica (T-05-07)', () => {
  it('no deja el fondo en negativo y cierra con devolución', async () => {
    const { branch, currency } = await branchWithMethod();

    const fund = await pettyCash.create(branch.id, {
      name: 'Caja chica administración',
      currencyId: currency.id,
      amount: 200,
    });

    expect(fund.balance).toBe(200);

    const afterExpense = await pettyCash.addMovement(
      branch.id,
      fund.id,
      { date: TODAY, type: 'EXPENSE', amount: 50, description: 'Taxi' },
      null
    );

    expect(afterExpense.balance).toBe(150);
    expect(afterExpense.spentSinceReplenishment).toBe(50);

    await expect(
      pettyCash.addMovement(branch.id, fund.id, { date: TODAY, type: 'EXPENSE', amount: 500 }, null)
    ).rejects.toThrow(/negativo/);

    await expect(
      pettyCash.close(branch.id, fund.id, null, { returnedAmount: 100 })
    ).rejects.toThrow(/saldo completo/);

    const closed = await pettyCash.close(branch.id, fund.id, null, { returnedAmount: 150 });
    expect(closed.status).toBe('CLOSED');
    expect(closed.balance).toBe(0);
  });
});

describe('Estado de cuenta con rango (T-05-06)', () => {
  it('devuelve saldo inicial, movimientos y saldo final', async () => {
    const { branch, currency, method } = await branchWithMethod();
    const partner = await createTestPartner({ type: 'CUSTOMER' });

    await treasury.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        methodId: method.id,
        amount: 300,
        currencyId: currency.id,
        exchangeRate: 1,
        type: 'INCOME' as never,
        date: new Date(`${TODAY}T10:00:00.000Z`),
      } as never,
      faker.string.uuid()
    );

    const statement = await treasury.getPartnerStatement(partner.id, branch.id, {
      from: TODAY,
      to: TODAY,
    });

    expect(statement.from).toBe(TODAY);
    expect(statement.movements?.length).toBe(1);
    expect(statement.openingBalance).toBe(0);
    expect(statement.closingBalance).toBe(-300);
  });
});
