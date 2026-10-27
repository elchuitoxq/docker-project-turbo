import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { testDb } from './database';
import { createTestBranch } from './factories';
import { accountingAccounts, accountingEntries, auditLogs } from '../schema';
import { AccountingService } from '../modules/accounting/accounting.service';
import { AuditService } from '../modules/audit/audit.service';

/**
 * Contabilidad de punta a punta contra Postgres real (`T-04-01` … `T-04-04`).
 * Los casos de jerarquía y cierre no se pueden probar con mocks sin reescribir el mock: lo que
 * importa es que la fila quede como dice la regla.
 */

const accounting = new AccountingService(undefined, new AuditService());

async function branchWithAccounts() {
  const branch = await createTestBranch();

  const cash = await accounting.createAccount({
    code: '1.1.1.001',
    name: 'Caja',
    type: 'ASSET' as never,
    branchId: branch.id,
  });

  const income = await accounting.createAccount({
    code: '4.1.1.001',
    name: 'Ingresos por ventas',
    type: 'REVENUE' as never,
    branchId: branch.id,
  });

  return { branch, cash, income };
}

function entryBody(
  branchId: string,
  cashId: string,
  incomeId: string,
  amount = 1000,
  date = '2026-10-15T00:00:00.000Z'
) {
  return {
    date,
    description: 'Venta de contado',
    branchId,
    lines: [
      { accountId: cashId, debit: amount, credit: 0 },
      { accountId: incomeId, debit: 0, credit: amount },
    ],
  };
}

describe('Plan de cuentas (T-04-01)', () => {
  it('al crear una hija la madre deja de ser imputable', async () => {
    const branch = await createTestBranch();
    const parent = await accounting.createAccount({
      code: `1.${faker.string.numeric(3)}`,
      name: 'Activo corriente',
      type: 'ASSET' as never,
      branchId: branch.id,
    });
    expect(parent.isPostable).toBe(true);

    await accounting.createAccount({
      code: `1.${faker.string.numeric(3)}.001`,
      name: 'Caja chica',
      type: 'ASSET' as never,
      branchId: branch.id,
      parentId: parent.id,
    });

    const reloaded = await accounting.findOneAccount(parent.id);
    expect(reloaded.isPostable).toBe(false);
  });

  it('no acepta una hija con naturaleza distinta a la madre', async () => {
    const { branch, cash } = await branchWithAccounts();

    await expect(
      accounting.createAccount({
        code: `5.${faker.string.numeric(4)}`,
        name: 'Gasto suelto',
        type: 'EXPENSE' as never,
        branchId: branch.id,
        parentId: cash.id,
      })
    ).rejects.toThrow(/cuenta madre/);
  });

  it('no permite postear contra una cuenta con hijas', async () => {
    const branch = await createTestBranch();
    const parent = await accounting.createAccount({
      code: `1.${faker.string.numeric(3)}`,
      name: 'Activo',
      type: 'ASSET' as never,
      branchId: branch.id,
    });
    const child = await accounting.createAccount({
      code: `1.${faker.string.numeric(3)}.9`,
      name: 'Caja',
      type: 'ASSET' as never,
      branchId: branch.id,
      parentId: parent.id,
    });
    const income = await accounting.createAccount({
      code: `4.${faker.string.numeric(3)}`,
      name: 'Ingreso',
      type: 'REVENUE' as never,
      branchId: branch.id,
    });

    // La hija sí es imputable; la madre no.
    await expect(
      accounting.createEntry(entryBody(branch.id, parent.id, income.id))
    ).rejects.toThrow(/no es imputable/);

    await expect(
      accounting.createEntry(entryBody(branch.id, child.id, income.id))
    ).resolves.toBeTruthy();
  });

  it('no deja eliminar una cuenta con cuentas hijas', async () => {
    const branch = await createTestBranch();
    const parent = await accounting.createAccount({
      code: `1.${faker.string.numeric(3)}.1`,
      name: 'Activo',
      type: 'ASSET' as never,
      branchId: branch.id,
    });
    await accounting.createAccount({
      code: `1.${faker.string.numeric(3)}.2`,
      name: 'Caja',
      type: 'ASSET' as never,
      branchId: branch.id,
      parentId: parent.id,
    });

    await expect(accounting.deleteAccount(parent.id)).rejects.toThrow(/cuentas hijas/);
  });

  it('no deja eliminar una cuenta con movimientos', async () => {
    const { branch, cash, income } = await branchWithAccounts();
    await accounting.createEntry(entryBody(branch.id, cash.id, income.id));

    await expect(accounting.deleteAccount(cash.id)).rejects.toThrow(/movimientos/);
  });

  it('desactiva (no borra) una cuenta sin uso', async () => {
    const branch = await createTestBranch();
    const account = await accounting.createAccount({
      code: `1.${faker.string.numeric(4)}`,
      name: 'Cuenta temporal',
      type: 'ASSET' as never,
      branchId: branch.id,
    });

    const result = await accounting.deleteAccount(account.id);
    expect(result).toEqual({ deleted: true, deactivated: true });

    const [row] = await testDb
      .select()
      .from(accountingAccounts)
      .where(eq(accountingAccounts.id, account.id));
    expect(row.isActive).toBe(false);
    expect(row.id).toBe(account.id);
  });

  it('no acepta jerarquías circulares', async () => {
    const branch = await createTestBranch();
    const parent = await accounting.createAccount({
      code: `1.${faker.string.numeric(3)}.5`,
      name: 'Raíz',
      type: 'ASSET' as never,
      branchId: branch.id,
    });
    const child = await accounting.createAccount({
      code: `1.${faker.string.numeric(3)}.6`,
      name: 'Hija',
      type: 'ASSET' as never,
      branchId: branch.id,
      parentId: parent.id,
    });

    await expect(accounting.updateAccount(parent.id, { parentId: child.id })).rejects.toThrow(
      /circular/
    );
  });

  it('no cambia el tipo de una cuenta con movimientos', async () => {
    const { branch, cash, income } = await branchWithAccounts();
    await accounting.createEntry(entryBody(branch.id, cash.id, income.id));

    await expect(accounting.updateAccount(cash.id, { type: 'EXPENSE' as never })).rejects.toThrow(
      /tipo de una cuenta con movimientos/
    );
  });
});

describe('Asientos: borrador y posteo (T-04-02)', () => {
  it('un borrador se edita y se postea; después ya no se toca', async () => {
    const { branch, cash, income } = await branchWithAccounts();

    const draft = await accounting.createEntry({
      ...entryBody(branch.id, cash.id, income.id, 500),
      status: 'DRAFT' as never,
    });
    expect(draft.status).toBe('DRAFT');
    expect(draft.postedAt ?? null).toBeNull();

    const edited = await accounting.updateEntry(draft.id, { description: 'Venta corregida' });
    expect(edited.description).toBe('Venta corregida');

    const posted = await accounting.postEntry(draft.id, undefined);
    expect(posted.status).toBe('POSTED');
    expect(posted.postedAt).toBeTruthy();

    await expect(accounting.updateEntry(draft.id, { description: 'Otra vez' })).rejects.toThrow(
      /borrador/
    );
    await expect(accounting.postEntry(draft.id)).rejects.toThrow(/ya está posteado/);
  });

  it('no postea un borrador descuadrado', async () => {
    const { branch, cash, income } = await branchWithAccounts();

    const draft = await accounting.createEntry({
      ...entryBody(branch.id, cash.id, income.id, 900),
      status: 'DRAFT' as never,
    });

    await expect(
      accounting.updateEntry(draft.id, {
        lines: [
          { accountId: cash.id, debit: 900, credit: 0 },
          { accountId: income.id, debit: 0, credit: 800 },
        ],
      })
    ).rejects.toThrow(/sum to zero/);
  });

  it('guarda el origen del asiento para no duplicarlo', async () => {
    const { branch, cash, income } = await branchWithAccounts();
    const sourceId = faker.string.uuid();

    const first = await accounting.createEntry({
      ...entryBody(branch.id, cash.id, income.id),
      sourceType: 'MANUAL' as never,
      sourceId,
    });
    expect(first.sourceType).toBe('MANUAL');
    expect(first.sourceId).toBe(sourceId);

    // La base rechaza el duplicado del par (sourceType, sourceId).
    await expect(
      accounting.createEntry({
        ...entryBody(branch.id, cash.id, income.id),
        sourceType: 'MANUAL' as never,
        sourceId,
      })
    ).rejects.toThrow();
  });
});

describe('Filtros de asientos (T-04-03)', () => {
  it('filtra por origen y por rango de fechas', async () => {
    const { branch, cash, income } = await branchWithAccounts();

    await accounting.createEntry({
      ...entryBody(branch.id, cash.id, income.id, 100, '2026-09-10T00:00:00.000Z'),
      sourceType: 'MANUAL' as never,
      sourceId: faker.string.uuid(),
    });
    await accounting.createEntry({
      ...entryBody(branch.id, cash.id, income.id, 200, '2026-10-10T00:00:00.000Z'),
      sourceType: 'PAYROLL' as never,
      sourceId: faker.string.uuid(),
    });

    const bySource = await accounting.findAllEntries({
      branchId: branch.id,
      sourceType: 'PAYROLL',
    });
    expect(bySource).toHaveLength(1);

    const detail = await accounting.findOneEntry(bySource[0].id, branch.id);
    expect(detail.lines.reduce((sum, line) => sum + line.debit, 0)).toBe(200);

    const byRange = await accounting.findAllEntries({
      branchId: branch.id,
      dateFrom: '2026-10-01T00:00:00.000Z',
      dateTo: '2026-10-31T23:59:59.999Z',
    });
    expect(byRange).toHaveLength(1);
  });
});

describe('Cierre de período (T-04-04)', () => {
  it('materializa los doce meses del año', async () => {
    const branch = await createTestBranch();

    const periods = await accounting.listPeriods(2026, branch.id);

    expect(periods).toHaveLength(12);
    expect(periods.every(period => period.status === 'OPEN')).toBe(true);
    expect(periods.map(period => period.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('un período cerrado rechaza asientos nuevos', async () => {
    const { branch, cash, income } = await branchWithAccounts();
    const periods = await accounting.listPeriods(2026, branch.id);
    const october = periods.find(period => period.month === 10)!;

    await accounting.closePeriod(october.id, undefined, branch.id);

    await expect(accounting.createEntry(entryBody(branch.id, cash.id, income.id))).rejects.toThrow(
      /está cerrado/
    );
  });

  it('reabrir exige motivo y queda auditado', async () => {
    const branch = await createTestBranch();
    const periods = await accounting.listPeriods(2026, branch.id);
    const march = periods.find(period => period.month === 3)!;

    await accounting.closePeriod(march.id, undefined, branch.id);

    await expect(accounting.reopenPeriod(march.id, '   ', undefined, branch.id)).rejects.toThrow(
      /motivo/
    );

    const reopened = await accounting.reopenPeriod(
      march.id,
      'Ajuste de retención omitida',
      undefined,
      branch.id
    );
    expect(reopened.status).toBe('OPEN');
    expect(reopened.reopenReason).toBe('Ajuste de retención omitida');

    const logs = await testDb
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.entityTable, 'accounting_periods'), eq(auditLogs.entityId, march.id))
      );
    expect(logs.map(log => log.action)).toContain('REOPEN');
  });

  it('no cierra dos veces el mismo período', async () => {
    const branch = await createTestBranch();
    const periods = await accounting.listPeriods(2026, branch.id);
    const june = periods.find(period => period.month === 6)!;

    await accounting.closePeriod(june.id);

    await expect(accounting.closePeriod(june.id)).rejects.toThrow(/ya está cerrado/);
  });

  it('un asiento ya posteado no se puede mover a un período cerrado', async () => {
    const { branch, cash, income } = await branchWithAccounts();
    const periods = await accounting.listPeriods(2026, branch.id);
    const october = periods.find(period => period.month === 10)!;

    const draft = await accounting.createEntry({
      ...entryBody(branch.id, cash.id, income.id, 300, '2026-11-05T00:00:00.000Z'),
      status: 'DRAFT' as never,
    });

    await accounting.closePeriod(october.id);

    // Postear un borrador de noviembre no lo bloquea el cierre de octubre.
    const posted = await accounting.postEntry(draft.id);
    expect(posted.status).toBe('POSTED');

    // Pero un asiento nuevo en octubre sí.
    await expect(
      accounting.createEntry(
        entryBody(branch.id, cash.id, income.id, 50, '2026-10-20T00:00:00.000Z')
      )
    ).rejects.toThrow(/está cerrado/);

    const [row] = await testDb
      .select()
      .from(accountingEntries)
      .where(eq(accountingEntries.id, posted.id));
    expect(row.status).toBe('POSTED');
  });
});
