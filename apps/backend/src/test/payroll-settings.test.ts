import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb } from './database';
import { createTestBranch, createTestUser } from './factories';
import { branches, currencies, payrollItemLines, payrollItems } from '../schema';
import { HrService } from '../modules/hr/services/hr.service';
import { PayrollConceptCategory, PayrollConceptKind } from '../modules/hr/dto/hr.dto';

/**
 * Procedimientos de configuración de nómina (`T-02-01` y `T-02-02`) contra Postgres real.
 * Lo que se verifica es el comportamiento del servicio, no cálculos locales.
 */
function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

describe('Parámetros de nómina con vigencia (T-02-01)', () => {
  const hr = new HrService();
  let branchId: string;

  beforeAll(async () => {
    const branch = await createTestBranch();
    branchId = branch.id;
    await createTestUser();
  });

  it('guarda dos vigencias y devuelve la que aplica a la fecha consultada', async () => {
    const key = `PARAM_${uniqueSuffix()}`;

    await hr.upsertPayrollSetting(
      { key, value: 4, type: 'PERCENT', effectiveFrom: '2025-01-01' },
      branchId
    );
    await hr.upsertPayrollSetting(
      { key, value: 6, type: 'PERCENT', effectiveFrom: '2026-06-01' },
      branchId
    );

    const january = await hr.findPayrollSettings(branchId, '2026-01-15');
    const july = await hr.findPayrollSettings(branchId, '2026-07-15');

    expect(january.find(s => s.key === key)?.value).toBe(4);
    expect(july.find(s => s.key === key)?.value).toBe(6);
  });

  it('actualiza la vigencia del mismo día en lugar de duplicarla', async () => {
    const key = `PARAM_${uniqueSuffix()}`;

    await hr.upsertPayrollSetting(
      { key, value: 10, type: 'NUMBER', effectiveFrom: '2026-03-01' },
      branchId
    );
    const updated = await hr.upsertPayrollSetting(
      { key, value: 12, type: 'NUMBER', effectiveFrom: '2026-03-01' },
      branchId
    );

    const all = await hr.findPayrollSettings(branchId, '2026-03-02');
    const matches = all.filter(s => s.key === key);

    expect(matches).toHaveLength(1);
    expect(matches[0].value).toBe(12);
    expect(updated.value).toBe(12);
  });

  it('rechaza un porcentaje fuera de (0, 100]', async () => {
    await expect(
      hr.upsertPayrollSetting(
        { key: `PARAM_${uniqueSuffix()}`, value: 400, type: 'PERCENT' },
        branchId
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige un número finito', async () => {
    await expect(
      hr.upsertPayrollSetting({ key: `PARAM_${uniqueSuffix()}`, value: Number.NaN }, branchId)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('falla con 404 si la sucursal no existe', async () => {
    await expect(
      hr.upsertPayrollSetting(
        { key: `PARAM_${uniqueSuffix()}`, value: 1 },
        '00000000-0000-4000-8000-0000000000ff'
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('congela los parámetros en el run y no los altera al cambiarlos después', async () => {
    const key = `PARAM_${uniqueSuffix()}`;
    await hr.upsertPayrollSetting(
      { key, value: 5, type: 'PERCENT', effectiveFrom: '2025-01-01' },
      branchId
    );

    const run = await createPayrollRun(hr, branchId, '2026-05-01', '2026-05-31');
    const frozen = await hr.getPayrollRunParameters(run.id);
    expect(frozen.find(s => s.key === key)?.value).toBe(5);

    await hr.upsertPayrollSetting(
      { key, value: 9, type: 'PERCENT', effectiveFrom: '2026-05-15' },
      branchId
    );

    const stillFrozen = await hr.getPayrollRunParameters(run.id);
    const live = await hr.findPayrollSettings(branchId, new Date().toISOString());

    expect(stillFrozen.find(s => s.key === key)?.value).toBe(5);
    expect(live.find(s => s.key === key)?.value).toBe(9);
  });

  it('numera los runs de forma global y sin repetir códigos entre sucursales', async () => {
    const otherBranch = await createTestBranch({ companyId: await companyOf(branchId) });

    const first = await createPayrollRun(hr, branchId, '2026-02-01', '2026-02-28');
    const second = await createPayrollRun(hr, otherBranch.id, '2026-02-01', '2026-02-28');

    expect(first.code).not.toBe(second.code);
    expect(second.code > first.code).toBe(true);
  });
});

describe('Conceptos de nómina declarativos (T-02-02)', () => {
  const hr = new HrService();
  let branchId: string;

  beforeAll(async () => {
    const branch = await createTestBranch();
    branchId = branch.id;
  });

  it('crea un concepto con fórmula y la devuelve en el listado', async () => {
    const code = `PRIMA_${uniqueSuffix()}`;

    const created = await hr.createPayrollConcept(
      {
        code,
        name: 'Prima de antigüedad',
        category: PayrollConceptCategory.ASSIGNMENT,
        kind: PayrollConceptKind.FORMULA,
        expression: 'SALARY_NORMAL * 0.05',
        affectsIntegralSalary: true,
      },
      branchId
    );

    expect(created.code).toBe(code);
    expect(created.kind).toBe(PayrollConceptKind.FORMULA);
    expect(created.affectsIntegralSalary).toBe(true);

    const list = await hr.getPayrollConceptTypes(branchId);
    expect(list.some(c => c.code === code)).toBe(true);
  });

  it('rechaza un concepto FORMULA sin expresión', async () => {
    await expect(
      hr.createPayrollConcept(
        {
          code: `SIN_FORMULA_${uniqueSuffix()}`,
          name: 'Sin fórmula',
          category: PayrollConceptCategory.ASSIGNMENT,
          kind: PayrollConceptKind.FORMULA,
        },
        branchId
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una expresión con identificadores desconocidos', async () => {
    await expect(
      hr.createPayrollConcept(
        {
          code: `MALA_${uniqueSuffix()}`,
          name: 'Mala',
          category: PayrollConceptCategory.ASSIGNMENT,
          kind: PayrollConceptKind.FORMULA,
          expression: 'SALARY_NORMAL * NO_EXISTE',
        },
        branchId
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un código duplicado en la misma empresa', async () => {
    const code = `DUP_${uniqueSuffix()}`;
    const payload = {
      code,
      name: 'Duplicado',
      category: PayrollConceptCategory.DEDUCTION,
    };

    await hr.createPayrollConcept(payload, branchId);
    await expect(hr.createPayrollConcept(payload, branchId)).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('actualiza nombre, categoría y fórmula de un concepto propio', async () => {
    const code = `EDIT_${uniqueSuffix()}`;
    const created = await hr.createPayrollConcept(
      { code, name: 'Original', category: PayrollConceptCategory.ASSIGNMENT },
      branchId
    );

    const updated = await hr.updatePayrollConcept(
      created.id,
      {
        name: 'Renombrado',
        category: PayrollConceptCategory.INFORMATIVE,
        kind: PayrollConceptKind.FORMULA,
        expression: 'SALARY_INTEGRAL / MONTH_DAYS',
        affectsIntegralSalary: false,
        isSalarial: false,
      },
      branchId
    );

    expect(updated.name).toBe('Renombrado');
    expect(updated.category).toBe(PayrollConceptCategory.INFORMATIVE);
    expect(updated.expression).toBe('SALARY_INTEGRAL / MONTH_DAYS');
    expect(updated.isSalarial).toBe(false);
  });

  it('rechaza actualizar a FORMULA sin expresión', async () => {
    const created = await hr.createPayrollConcept(
      {
        code: `FIX_${uniqueSuffix()}`,
        name: 'Fijo',
        category: PayrollConceptCategory.ASSIGNMENT,
      },
      branchId
    );

    await expect(
      hr.updatePayrollConcept(created.id, { kind: PayrollConceptKind.FORMULA }, branchId)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('elimina un concepto propio que no se ha usado', async () => {
    const created = await hr.createPayrollConcept(
      {
        code: `DEL_${uniqueSuffix()}`,
        name: 'Para borrar',
        category: PayrollConceptCategory.ASSIGNMENT,
      },
      branchId
    );

    await expect(hr.deletePayrollConcept(created.id, branchId)).resolves.toEqual({ deleted: true });
    await expect(hr.deletePayrollConcept(created.id, branchId)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('no elimina un concepto que ya aparece en una nómina', async () => {
    const code = `USED_${uniqueSuffix()}`;
    const created = await hr.createPayrollConcept(
      { code, name: 'Usado', category: PayrollConceptCategory.DEDUCTION },
      branchId
    );

    const run = await createPayrollRun(hr, branchId, '2026-04-01', '2026-04-30');
    const [item] = await testDb
      .insert(payrollItems)
      .values({
        runId: run.id,
        employeeId: crypto.randomUUID(),
        baseAmount: '0.00',
        netTotal: '0.00',
      })
      .returning();

    await testDb.insert(payrollItemLines).values({
      itemId: item.id,
      conceptCode: code,
      conceptName: 'Usado',
      category: 'DEDUCTION',
      amount: '1.00',
    });

    await expect(hr.deletePayrollConcept(created.id, branchId)).rejects.toBeInstanceOf(
      ConflictException
    );
  });
});

async function companyOf(branchId: string): Promise<string> {
  const [branch] = await testDb
    .select({ companyId: branches.companyId })
    .from(branches)
    .where(and(eq(branches.id, branchId)))
    .limit(1);

  if (!branch) throw new Error(`Branch ${branchId} not found`);
  return branch.companyId;
}

async function createPayrollRun(
  hr: HrService,
  branchId: string,
  startDate: string,
  endDate: string
) {
  const [currency] = await testDb
    .select({ id: currencies.id })
    .from(currencies)
    .where(eq(currencies.isBase, true))
    .limit(1);
  if (!currency) throw new Error('No base currency configured');

  return hr.generatePayroll(
    {
      branchId,
      frequency: 'MONTHLY',
      currencyId: currency.id,
      startDate,
      endDate,
    } as never,
    '00000000-0000-4000-8000-0000000000aa'
  );
}
