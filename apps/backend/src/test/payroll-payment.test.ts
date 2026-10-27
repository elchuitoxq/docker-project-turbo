import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb } from './database';
import { createTestBranch, createTestEmployee, ensureTestBaseCurrency } from './factories';
import {
  bankAccounts,
  currencies,
  exchangeRates,
  paymentMethods,
  payments,
  payrollConceptTypes,
  payrollRuns,
} from '../schema';
import { HrService } from '../modules/hr/services/hr.service';
import { PayrollCalculator } from '../modules/hr/payroll/payroll.calculator';
import { LaborBenefits } from '../modules/hr/payroll/labor-benefits';
import { TreasuryService } from '../modules/treasury/services/treasury.service';
import { MoneyService } from '../common/money/money.service';

/**
 * Pago de nómina contra tesorería (`T-02-06`, RN-24) contra Postgres real.
 * La invariante central: dos peticiones de pago producen **un** solo movimiento.
 */

const hr = new HrService(
  new PayrollCalculator(),
  undefined,
  new LaborBenefits(),
  new TreasuryService(new MoneyService())
);

async function setup() {
  const branch = await createTestBranch();
  const currency = await ensureTestBaseCurrency();

  await testDb.insert(payrollConceptTypes).values({
    companyId: branch.companyId,
    code: 'SALARY',
    name: 'Sueldo',
    category: 'ASSIGNMENT',
    kind: 'FORMULA',
    expression: 'SALARY_BASE * (PERIOD_DAYS / MONTH_DAYS)',
    affectsIntegralSalary: true,
    isSalarial: true,
    isSystem: true,
    branchId: null,
  });

  const employee = await createTestEmployee({
    branchId: branch.id,
    baseSalary: '10000.00',
    salaryCurrencyId: currency.id,
  });

  const [method] = await testDb
    .insert(paymentMethods)
    .values({ code: 'TRANSFER', name: 'Transferencia', branchId: branch.id })
    .returning();

  const [account] = await testDb
    .insert(bankAccounts)
    .values({
      name: `Cuenta ${branch.id.slice(0, 6)}`,
      type: 'CHECKING',
      currencyId: currency.id,
      branchId: branch.id,
      currentBalance: '50000.00',
    })
    .returning();

  const run = await hr.generatePayroll(
    {
      branchId: branch.id,
      frequency: 'MONTHLY',
      currencyId: currency.id,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    } as never,
    '00000000-0000-4000-8000-0000000000cc'
  );

  return { branch, currency, employee, method, account, run };
}

describe('Pago de nómina (T-02-06)', () => {
  it('registra un pago por el neto del run y lo marca como pagado', async () => {
    const { branch, currency, account, method, run } = await setup();

    const result = await hr.payPayrollRun(
      run.id,
      { methodId: method.id, bankAccountId: account.id },
      branch.id
    );

    expect(result.alreadyPaid).toBe(false);
    expect(result.amount).toBeCloseTo(10_000, 2);
    expect(result.amountBase).toBeCloseTo(10_000, 2);
    expect(result.exchangeRate).toBe(1);
    expect(result.runStatus).toBe('PAID');
    expect(result.paymentCode).toMatch(/^PAY-\d+$/);

    const [row] = await testDb.select().from(payrollRuns).where(eq(payrollRuns.id, run.id));
    expect(row.status).toBe('PAID');
    expect(row.currencyId).toBe(currency.id);
  });

  it('dos llamadas producen un solo movimiento (RN-24)', async () => {
    const { branch, method, run } = await setup();

    const first = await hr.payPayrollRun(run.id, { methodId: method.id }, branch.id);
    const second = await hr.payPayrollRun(run.id, { methodId: method.id }, branch.id);

    expect(second.alreadyPaid).toBe(true);
    expect(second.paymentId).toBe(first.paymentId);
    expect(second.paymentCode).toBe(first.paymentCode);

    const rows = await testDb
      .select()
      .from(payments)
      .where(and(eq(payments.payrollRunId, run.id)));
    expect(rows).toHaveLength(1);
  });

  it('descuenta el monto de la cuenta bancaria', async () => {
    const { branch, account, method, run } = await setup();

    await hr.payPayrollRun(run.id, { methodId: method.id, bankAccountId: account.id }, branch.id);

    const [row] = await testDb.select().from(bankAccounts).where(eq(bankAccounts.id, account.id));
    expect(Number(row.currentBalance)).toBeCloseTo(40_000, 2);
  });

  it('no paga un run sin monto', async () => {
    const branch = await createTestBranch();
    const currency = await ensureTestBaseCurrency();
    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: 'TRANSFER', name: 'Transferencia', branchId: branch.id })
      .returning();

    // Sin empleados el run se genera vacío: total 0.
    const run = await hr.generatePayroll(
      {
        branchId: branch.id,
        frequency: 'MONTHLY',
        currencyId: currency.id,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      } as never,
      '00000000-0000-4000-8000-0000000000cc'
    );

    await expect(hr.payPayrollRun(run.id, { methodId: method.id }, branch.id)).rejects.toThrow(
      /no tiene monto a pagar/
    );
  });

  it('no paga un run inexistente', async () => {
    const { branch, method } = await setup();

    await expect(
      hr.payPayrollRun('00000000-0000-4000-8000-0000000000ff', { methodId: method.id }, branch.id)
    ).rejects.toThrow(/Payroll run with ID .* not found/);
  });

  it('no paga la nómina de otra sucursal', async () => {
    const { method, run } = await setup();
    const other = await createTestBranch();

    await expect(hr.payPayrollRun(run.id, { methodId: method.id }, other.id)).rejects.toThrow(
      /not found/
    );
  });

  it('usa una tasa manual cuando la moneda del run no es la funcional', async () => {
    const branch = await createTestBranch();
    const base = await ensureTestBaseCurrency();
    const [foreign] = await testDb
      .insert(currencies)
      .values({
        code: `US${Date.now().toString(36).slice(-3).toUpperCase()}`,
        name: 'Divisa',
        symbol: 'X',
      })
      .returning();

    await testDb.insert(payrollConceptTypes).values({
      companyId: branch.companyId,
      code: 'SALARY',
      name: 'Sueldo',
      category: 'ASSIGNMENT',
      kind: 'FORMULA',
      expression: 'SALARY_BASE * (PERIOD_DAYS / MONTH_DAYS)',
      affectsIntegralSalary: true,
      isSalarial: true,
      isSystem: true,
      branchId: null,
    });

    await createTestEmployee({
      branchId: branch.id,
      baseSalary: '100.00',
      salaryCurrencyId: foreign.id,
    });

    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: 'TRANSFER', name: 'Transferencia', branchId: branch.id })
      .returning();

    const run = await hr.generatePayroll(
      {
        branchId: branch.id,
        frequency: 'MONTHLY',
        currencyId: foreign.id,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      } as never,
      '00000000-0000-4000-8000-0000000000cc'
    );

    const result = await hr.payPayrollRun(
      run.id,
      { methodId: method.id, exchangeRate: 36.5 },
      branch.id
    );

    expect(result.amount).toBeCloseTo(100, 2);
    expect(result.exchangeRate).toBe(36.5);
    expect(result.amountBase).toBeCloseTo(3_650, 2);
    expect(result.currencyId).toBe(foreign.id);
    expect(base.id).not.toBe(foreign.id);
  });

  it('exige la tasa si el run está en divisa y no se envía una manual', async () => {
    const branch = await createTestBranch();
    await ensureTestBaseCurrency();
    const [foreign] = await testDb
      .insert(currencies)
      .values({
        code: `ZZ${Date.now().toString(36).slice(-3).toUpperCase()}`,
        name: 'Divisa',
        symbol: 'Z',
      })
      .returning();

    await testDb.insert(exchangeRates).values({
      currencyId: foreign.id,
      rate: '20.00',
      date: new Date('2026-10-01T00:00:00.000Z'),
      source: 'BCV',
    });

    await testDb.insert(payrollConceptTypes).values({
      companyId: branch.companyId,
      code: 'SALARY',
      name: 'Sueldo',
      category: 'ASSIGNMENT',
      kind: 'FORMULA',
      expression: 'SALARY_BASE * (PERIOD_DAYS / MONTH_DAYS)',
      affectsIntegralSalary: true,
      isSalarial: true,
      isSystem: true,
      branchId: null,
    });
    await createTestEmployee({
      branchId: branch.id,
      baseSalary: '100.00',
      salaryCurrencyId: foreign.id,
    });

    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: 'TRANSFER', name: 'Transferencia', branchId: branch.id })
      .returning();

    const run = await hr.generatePayroll(
      {
        branchId: branch.id,
        frequency: 'MONTHLY',
        currencyId: foreign.id,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      } as never,
      '00000000-0000-4000-8000-0000000000cc'
    );

    // La tasa existía al generar; se retira antes de pagar para forzar el caso.
    await testDb.delete(exchangeRates).where(eq(exchangeRates.currencyId, foreign.id));

    await expect(hr.payPayrollRun(run.id, { methodId: method.id }, branch.id)).rejects.toThrow(
      /Falta la tasa de cambio/
    );
  });
});
