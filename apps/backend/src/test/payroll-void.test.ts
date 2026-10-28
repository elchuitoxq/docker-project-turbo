import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './database';
import { createTestBranch } from './factories';
import {
  accountingAccounts,
  accountingEntries,
  accountingEntryLines,
  accountingMaps,
  currencies,
  paymentMethods,
  payments,
  payrollItemLines,
  payrollItems,
  payrollRuns,
} from '../schema';
import { HrService } from '../modules/hr/services/hr.service';

/**
 * Anulación de un run de nómina (`P-29`, RN-21).
 *
 * Un run pagado o contabilizado es inmutable: corregirlo exige anularlo y generar uno nuevo. La
 * anulación no borra nada —deja autor, fecha y motivo— y, si el run estaba contabilizado, crea el
 * asiento de reversión para que el libro cuadre sin tocar el asiento original.
 */

const ACCOUNTS = {
  gastoSueldos: '6.1.1.001',
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

async function scenario(status: 'PROCESSED' | 'PAID' | 'DRAFT' = 'PROCESSED') {
  const branch = await createTestBranch();
  const currency = await ensureBaseCurrency();
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();

  const codes = {
    salary: `SALARY_${tag}`,
    ssoEmp: `SSO_EMP_${tag}`,
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
  ]);

  const [run] = await testDb
    .insert(payrollRuns)
    .values({
      code: `NOM-V-${tag}`,
      branchId: branch.id,
      frequency: 'MONTHLY',
      currencyId: currency.id,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-31T00:00:00.000Z'),
      totalAmount: '1060',
      status,
    })
    .returning();

  const [item] = await testDb
    .insert(payrollItems)
    .values({
      runId: run.id,
      employeeId: '00000000-0000-4000-8000-000000000999',
      baseAmount: '1100',
      netTotal: '1060',
    })
    .returning({ id: payrollItems.id });

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
  ]);

  return { run, branch, currency, codes };
}

/** Asiento originado por el run (fuente `PAYROLL`). */
async function entryOf(runId: string) {
  const [entry] = await testDb
    .select()
    .from(accountingEntries)
    .where(eq(accountingEntries.sourceId, runId))
    .limit(1);
  if (!entry) return null;

  const lines = await testDb
    .select()
    .from(accountingEntryLines)
    .where(eq(accountingEntryLines.entryId, entry.id));

  return { entry, lines };
}

describe('Anulación del run de nómina (P-29, RN-21)', () => {
  const service = new HrService();

  it('marca el run como VOID con motivo, autor y fecha', async () => {
    const { run, branch } = await scenario();

    const voided = await service.voidPayrollRun(
      run.id,
      'Se pagó el sueldo equivocado',
      undefined,
      branch.id
    );

    expect(voided.status).toBe('VOID');
    expect(voided.voidReason).toBe('Se pagó el sueldo equivocado');
    expect(voided.voidedAt).toBeInstanceOf(Date);

    const [stored] = await testDb.select().from(payrollRuns).where(eq(payrollRuns.id, run.id));
    expect(stored.status).toBe('VOID');
    expect(stored.voidReason).toBe('Se pagó el sueldo equivocado');
  });

  it('crea la reversión espejo del asiento contabilizado, sin tocar el original', async () => {
    const { run, branch } = await scenario();
    const original = await service.postPayrollRun(run.id, branch.id);

    await service.voidPayrollRun(run.id, 'Error en el período', undefined, branch.id);

    const [reversal] = await testDb
      .select()
      .from(accountingEntries)
      .where(eq(accountingEntries.reference, `REV-${run.code}`))
      .limit(1);

    expect(reversal).toBeDefined();
    expect(reversal.status).toBe('POSTED');
    expect(reversal.description).toContain('Error en el período');

    const reversalLines = await testDb
      .select()
      .from(accountingEntryLines)
      .where(eq(accountingEntryLines.entryId, reversal.id));

    // Cada línea de la reversión es el espejo exacto de la del asiento original.
    for (const line of original.lines) {
      const mirror = reversalLines.find(item => item.accountId === line.accountId);
      expect(mirror, `falta la cuenta ${line.accountId} en la reversión`).toBeDefined();
      expect(Number(mirror!.debit)).toBeCloseTo(line.credit, 2);
      expect(Number(mirror!.credit)).toBeCloseTo(line.debit, 2);
    }

    const totalDebit = reversalLines.reduce((sum, line) => sum + Number(line.debit), 0);
    const totalCredit = reversalLines.reduce((sum, line) => sum + Number(line.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);

    // El asiento original sigue posteado: la historia no se reescribe.
    const stillThere = await entryOf(run.id);
    expect(stillThere?.entry.status).toBe('POSTED');
    expect(stillThere?.lines).toHaveLength(original.lines.length);
  });

  it('anular un run no contabilizado no inventa asientos', async () => {
    const { run, branch } = await scenario();

    await service.voidPayrollRun(run.id, 'Se generó por error', undefined, branch.id);

    const entries = await testDb
      .select()
      .from(accountingEntries)
      .where(eq(accountingEntries.reference, `REV-${run.code}`));

    expect(entries).toHaveLength(0);
  });

  it('no anula dos veces el mismo run', async () => {
    const { run, branch } = await scenario();
    await service.voidPayrollRun(run.id, 'Primera anulación', undefined, branch.id);

    await expect(
      service.voidPayrollRun(run.id, 'Segunda anulación', undefined, branch.id)
    ).rejects.toThrow(/ya está anulada/);
  });

  it('un borrador no se anula: se descarta antes de procesarlo', async () => {
    const { run, branch } = await scenario('DRAFT');

    await expect(
      service.voidPayrollRun(run.id, 'Borrador equivocado', undefined, branch.id)
    ).rejects.toThrow(/borrador/i);
  });

  it('con un pago vivo exige anular el pago en Tesorería primero', async () => {
    const { run, branch, currency } = await scenario('PAID');
    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: 'TRANSFER', name: 'Transferencia', branchId: branch.id })
      .returning();

    await testDb.insert(payments).values({
      code: `PAY-V-${Date.now().toString(36).toUpperCase()}`,
      branchId: branch.id,
      methodId: method.id,
      type: 'EXPENSE',
      direction: 'OUT',
      status: 'POSTED',
      amount: '1060',
      currencyId: currency.id,
      exchangeRate: '1',
      amountBase: '1060',
      payrollRunId: run.id,
    });

    await expect(
      service.voidPayrollRun(run.id, 'Sueldo equivocado', undefined, branch.id)
    ).rejects.toThrow(/Tesorería/);
  });

  it('después de anular el pago sí se puede anular la nómina', async () => {
    const { run, branch, currency } = await scenario('PAID');
    const [method] = await testDb
      .insert(paymentMethods)
      .values({ code: 'TRANSFER', name: 'Transferencia', branchId: branch.id })
      .returning();

    const [payment] = await testDb
      .insert(payments)
      .values({
        code: `PAY-V2-${Date.now().toString(36).toUpperCase()}`,
        branchId: branch.id,
        methodId: method.id,
        type: 'EXPENSE',
        direction: 'OUT',
        status: 'VOID',
        amount: '1060',
        currencyId: currency.id,
        exchangeRate: '1',
        amountBase: '1060',
        payrollRunId: run.id,
      })
      .returning({ id: payments.id });

    const voided = await service.voidPayrollRun(run.id, 'Sueldo equivocado', undefined, branch.id);

    expect(payment.id).toBeDefined();
    expect(voided.status).toBe('VOID');
  });

  it('no anula una nómina de otra sucursal', async () => {
    const { run } = await scenario();
    const otherBranch = await createTestBranch();

    await expect(
      service.voidPayrollRun(run.id, 'Motivo cualquiera', undefined, otherBranch.id)
    ).rejects.toThrow(/not found/i);
  });
});
