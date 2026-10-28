import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './database';
import { createTestBranch } from './factories';
import {
  accountingAccounts,
  accountingEntries,
  accountingMaps,
  currencies,
  payrollItemLines,
  payrollItems,
  payrollRuns,
} from '../schema';
import { HrService } from '../modules/hr/services/hr.service';

/** Códigos del plan de cuentas que usa el mapeo de nómina (igual que `seed-test`). */
const ACCOUNTS = {
  gastoSueldos: '6.1.1.001',
  gastoCargas: '6.1.1.002',
  islrPagar: '2.1.1.003',
  sueldosPagar: '2.1.1.004',
  aportesPagar: '2.1.1.005',
};

async function ensureBaseCurrency() {
  const [existing] = await testDb
    .select()
    .from(currencies)
    .where(eq(currencies.isBase, true))
    .limit(1);
  if (existing) return existing;

  const [created] = await testDb
    .insert(currencies)
    .values({ code: 'VES', name: 'Bolívar', symbol: 'Bs', isBase: true })
    .onConflictDoUpdate({ target: currencies.code, set: { isBase: true } })
    .returning();

  return created;
}

async function scenario(options: { extraConcept?: string } = {}) {
  const branch = await createTestBranch();
  const currency = await ensureBaseCurrency();

  // Los mapas contables son globales por módulo: cada escenario usa códigos de concepto propios
  // para que el mapeo de otro test no se cuele en este (RN-25).
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();
  const codes = {
    salary: `SALARY_${tag}`,
    ssoEmp: `SSO_EMP_${tag}`,
    ssoPat: `SSO_PAT_${tag}`,
  };

  const accountIds = new Map<string, string>();
  for (const code of Object.values(ACCOUNTS)) {
    const [account] = await testDb
      .insert(accountingAccounts)
      .values({
        code,
        name: `Cuenta ${code}`,
        type: code.startsWith('6') ? 'EXPENSE' : 'LIABILITY',
        branchId: branch.id,
        isActive: true,
      })
      .returning({ id: accountingAccounts.id });
    accountIds.set(code, account.id);
  }

  // Los mapas de nómina son globales por módulo: se insertan siempre y la prueba de RN-25 usa un
  // concepto que no está mapeado (`extraConcept`), en vez de borrar los mapas de los demás casos.
  await testDb.insert(accountingMaps).values([
    {
      module: 'PAYROLL',
      transactionType: codes.salary,
      debitAccountId: accountIds.get(ACCOUNTS.gastoSueldos),
      creditAccountId: accountIds.get(ACCOUNTS.sueldosPagar),
    },
    {
      module: 'PAYROLL',
      transactionType: codes.ssoEmp,
      debitAccountId: accountIds.get(ACCOUNTS.sueldosPagar),
      creditAccountId: accountIds.get(ACCOUNTS.aportesPagar),
    },
    {
      module: 'PAYROLL',
      transactionType: codes.ssoPat,
      debitAccountId: accountIds.get(ACCOUNTS.gastoCargas),
      creditAccountId: accountIds.get(ACCOUNTS.aportesPagar),
    },
  ]);

  const [run] = await testDb
    .insert(payrollRuns)
    .values({
      code: `NOM-T-${Date.now().toString(36).toUpperCase()}`,
      branchId: branch.id,
      frequency: 'MONTHLY',
      currencyId: currency.id,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-31T00:00:00.000Z'),
      totalAmount: '1050',
      status: 'PAID',
    })
    .returning();

  await testDb.insert(payrollItems).values({
    runId: run.id,
    employeeId: '00000000-0000-4000-8000-000000000999',
    baseAmount: '1100',
    netTotal: '1050',
  });

  const [item] = await testDb
    .select({ id: payrollItems.id })
    .from(payrollItems)
    .where(eq(payrollItems.runId, run.id))
    .limit(1);

  await testDb.insert(payrollItemLines).values([
    {
      itemId: item.id,
      conceptCode: codes.salary,
      conceptName: 'Sueldo',
      category: 'ASSIGNMENT',
      base: '1100',
      amount: '1100',
    },
    {
      itemId: item.id,
      conceptCode: codes.ssoEmp,
      conceptName: 'SSO empleado',
      category: 'DEDUCTION',
      base: '1100',
      amount: '40',
    },
    {
      itemId: item.id,
      conceptCode: codes.ssoPat,
      conceptName: 'SSO patronal',
      category: 'EMPLOYER_CONTRIBUTION',
      base: '1100',
      amount: '90',
    },
    {
      itemId: item.id,
      conceptCode: 'IVSS_BASE',
      conceptName: 'Base IVSS',
      category: 'INFORMATIVE',
      base: '1100',
      amount: '1100',
    },
  ]);

  if (options.extraConcept) {
    await testDb.insert(payrollItemLines).values({
      itemId: item.id,
      conceptCode: options.extraConcept,
      conceptName: 'Concepto sin mapeo',
      category: 'ASSIGNMENT',
      base: '50',
      amount: '50',
    });
  }

  return { run, branch, accountIds, codes };
}

describe('Contabilización del run de nómina (H-59, RN-25)', () => {
  const service = new HrService();

  it('genera el asiento por concepto y deja el neto en sueldos por pagar', async () => {
    const { run, branch, accountIds } = await scenario();

    const entry = await service.postPayrollRun(run.id, branch.id);

    const byAccount = new Map(entry.lines.map(line => [line.accountId, line]));
    expect(byAccount.get(accountIds.get(ACCOUNTS.gastoSueldos)!)).toMatchObject({
      debit: 1100,
      credit: 0,
    });
    expect(byAccount.get(accountIds.get(ACCOUNTS.sueldosPagar)!)).toMatchObject({
      debit: 40,
      credit: 1100,
    });
    expect(byAccount.get(accountIds.get(ACCOUNTS.aportesPagar)!)).toMatchObject({
      credit: 130,
    });
    expect(byAccount.get(accountIds.get(ACCOUNTS.gastoCargas)!)).toMatchObject({ debit: 90 });

    const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(entry.status).toBe('POSTED');
    expect(entry.sourceType).toBe('PAYROLL');
    expect(entry.sourceId).toBe(run.id);
    expect(entry.reference).toBe(run.code);
  });

  it('es idempotente: dos llamadas devuelven el mismo asiento', async () => {
    const { run, branch } = await scenario();

    const first = await service.postPayrollRun(run.id, branch.id);
    const second = await service.postPayrollRun(run.id, branch.id);

    expect(second.id).toBe(first.id);

    const entries = await testDb
      .select({ id: accountingEntries.id })
      .from(accountingEntries)
      .where(eq(accountingEntries.sourceId, run.id));
    expect(entries).toHaveLength(1);
  });

  it('falla si un concepto con monto no tiene mapeo (RN-25)', async () => {
    const { run, branch } = await scenario({ extraConcept: 'CONCEPTO_SIN_MAPEO' });

    await expect(service.postPayrollRun(run.id, branch.id)).rejects.toThrow(/mapeo contable/);
    await expect(service.postPayrollRun(run.id, branch.id)).rejects.toThrow(/CONCEPTO_SIN_MAPEO/);
  });

  it('no expone el run de otra sucursal', async () => {
    const { run } = await scenario();
    const otra = await createTestBranch();

    await expect(service.postPayrollRun(run.id, otra.id)).rejects.toThrow(/not found/);
  });
});
