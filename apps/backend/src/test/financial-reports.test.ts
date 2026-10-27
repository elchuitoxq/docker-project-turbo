import { describe, it, expect } from 'vitest';
import { createTestBranch } from './factories';
import { AccountingService } from '../modules/accounting/accounting.service';
import { FinancialReportsService } from '../modules/reports/financial-reports.service';

/**
 * Estados financieros (`T-04-05` … `T-04-07`) contra Postgres real: lo que se verifica es que el
 * libro cuadre, no que una función pura devuelva números.
 */

const accounting = new AccountingService();
const reports = new FinancialReportsService();

/** Libro mínimo: aporte de capital, venta de contado y un gasto pagado en efectivo. */
async function book() {
  const branch = await createTestBranch();

  const cash = await accounting.createAccount({
    code: '1.1.1.001',
    name: 'Caja',
    type: 'ASSET' as never,
    branchId: branch.id,
  });
  const capital = await accounting.createAccount({
    code: '3.1.1.001',
    name: 'Capital social',
    type: 'EQUITY' as never,
    branchId: branch.id,
  });
  const payable = await accounting.createAccount({
    code: '2.1.1.001',
    name: 'Cuentas por pagar',
    type: 'LIABILITY' as never,
    branchId: branch.id,
  });
  const revenue = await accounting.createAccount({
    code: '4.1.1.001',
    name: 'Ingresos por ventas',
    type: 'REVENUE' as never,
    branchId: branch.id,
  });
  const cost = await accounting.createAccount({
    code: '5.1.1.001',
    name: 'Costo de ventas',
    type: 'COST' as never,
    branchId: branch.id,
  });
  const expense = await accounting.createAccount({
    code: '6.1.1.001',
    name: 'Gastos operativos',
    type: 'EXPENSE' as never,
    branchId: branch.id,
  });

  const entry = (
    description: string,
    date: string,
    lines: Array<{ accountId: string; debit?: number; credit?: number }>
  ) =>
    accounting.createEntry({
      date,
      description,
      branchId: branch.id,
      lines: lines.map(line => ({ ...line, debit: line.debit ?? 0, credit: line.credit ?? 0 })),
    });

  // Aporte de capital 10.000
  await entry('Aporte de capital', '2026-10-01T00:00:00.000Z', [
    { accountId: cash.id, debit: 10_000 },
    { accountId: capital.id, credit: 10_000 },
  ]);
  // Venta a crédito 3.000 (queda una cuenta por cobrar implícita en caja para simplificar)
  await entry('Venta de contado', '2026-10-10T00:00:00.000Z', [
    { accountId: cash.id, debit: 3_000 },
    { accountId: revenue.id, credit: 3_000 },
  ]);
  // Costo de la venta 1.200
  await entry('Costo de la venta', '2026-10-10T00:00:00.000Z', [
    { accountId: cost.id, debit: 1_200 },
    { accountId: payable.id, credit: 1_200 },
  ]);
  // Gasto pagado 800
  await entry('Gasto operativo', '2026-10-20T00:00:00.000Z', [
    { accountId: expense.id, debit: 800 },
    { accountId: cash.id, credit: 800 },
  ]);

  return { branch, cash, capital, payable, revenue, cost, expense };
}

describe('Balance de comprobación (T-04-05)', () => {
  it('suma debe y haber y cuadra', async () => {
    const { branch } = await book();

    const report = await reports.trialBalance(branch.id, '2026-10-01', '2026-10-31');

    expect(report.rows.length).toBe(6);
    expect(report.totals.debit).toBe(15_000);
    expect(report.totals.credit).toBe(15_000);
    expect(report.totals.difference).toBe(0);
    expect(report.balanced).toBe(true);
  });

  it('deja fuera los borradores', async () => {
    const { branch, cash, revenue } = await book();

    await accounting.createEntry({
      date: '2026-10-25T00:00:00.000Z',
      description: 'Borrador que no debe aparecer',
      branchId: branch.id,
      status: 'DRAFT' as never,
      lines: [
        { accountId: cash.id, debit: 99_999, credit: 0 },
        { accountId: revenue.id, debit: 0, credit: 99_999 },
      ],
    });

    const report = await reports.trialBalance(branch.id, '2026-10-01', '2026-10-31');

    expect(report.totals.debit).toBe(15_000);
    expect(report.rows.some(row => row.debit > 90_000)).toBe(false);
  });

  it('no mezcla sucursales', async () => {
    const { branch } = await book();
    const other = await createTestBranch();

    const report = await reports.trialBalance(other.id, '2026-10-01', '2026-10-31');

    expect(report.rows).toHaveLength(0);
    expect(report.totals.debit).toBe(0);
    expect(report.branchId).toBe(other.id);
    expect(branch.id).not.toBe(other.id);
  });
});

describe('Balance general (T-04-06)', () => {
  it('activo = pasivo + patrimonio + resultado', async () => {
    const { branch } = await book();

    const report = await reports.balanceSheet(branch.id, '2026-10-31T23:59:59.999Z');

    // Caja: 10.000 + 3.000 − 800 = 12.200
    expect(report.totals.assets).toBe(12_200);
    expect(report.totals.liabilities).toBe(1_200);
    expect(report.totals.equity).toBe(10_000);
    // Resultado: 3.000 − 1.200 − 800
    expect(report.totals.result).toBe(1_000);
    expect(report.totals.liabilitiesAndEquity).toBe(12_200);
    expect(report.totals.difference).toBe(0);
    expect(report.balanced).toBe(true);
  });

  it('respeta el corte de fecha', async () => {
    const { branch } = await book();

    const before = await reports.balanceSheet(branch.id, '2026-10-05T00:00:00.000Z');

    expect(before.totals.assets).toBe(10_000);
    expect(before.totals.result).toBe(0);
    expect(before.balanced).toBe(true);
  });
});

describe('Estado de resultados (T-04-07)', () => {
  it('resultado = ingresos − costos − gastos', async () => {
    const { branch } = await book();

    const report = await reports.incomeStatement(branch.id, '2026-10-01', '2026-10-31');

    expect(report.totals.revenue).toBe(3_000);
    expect(report.totals.costs).toBe(1_200);
    expect(report.totals.grossProfit).toBe(1_800);
    expect(report.totals.expenses).toBe(800);
    expect(report.totals.result).toBe(1_000);

    expect(report.revenue.map(line => line.code)).toEqual(['4.1.1.001']);
    expect(report.costs.map(line => line.code)).toEqual(['5.1.1.001']);
    expect(report.expenses.map(line => line.code)).toEqual(['6.1.1.001']);
  });

  it('el resultado del rango no arrastra el de meses anteriores', async () => {
    const { branch } = await book();

    const november = await reports.incomeStatement(branch.id, '2026-11-01', '2026-11-30');

    expect(november.totals.revenue).toBe(0);
    expect(november.totals.result).toBe(0);
  });

  it('rechaza un rango invertido', async () => {
    const branch = await createTestBranch();

    await expect(reports.incomeStatement(branch.id, '2026-10-31', '2026-10-01')).rejects.toThrow(
      /invertido/
    );
  });
});
