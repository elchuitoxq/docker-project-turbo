import { describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { testDb } from './database';
import { createTestBranch, ensureTestBaseCurrency } from './factories';
import {
  currencies,
  employeeBenefits,
  employeeProfitSharing,
  employeeVacations,
  employees,
  payrollConceptTypes,
  payrollSettings,
} from '../schema';
import { HrService } from '../modules/hr/services/hr.service';
import { PayrollCalculator } from '../modules/hr/payroll/payroll.calculator';
import { LaborBenefits } from '../modules/hr/payroll/labor-benefits';

/**
 * Prestaciones, vacaciones y utilidades de punta a punta (`T-02-04`) contra Postgres real.
 * El salario integral se toma del motor de nómina, así que aquí también se verifica ese enlace.
 */

const EFFECTIVE_FROM = new Date('2020-01-01T00:00:00.000Z');
const HIRE_DATE = new Date('2023-01-15T00:00:00.000Z');
const AS_OF = '2026-10-27';

const hr = new HrService(new PayrollCalculator(), undefined, new LaborBenefits());

async function baseCurrency() {
  return await ensureTestBaseCurrency();
}

async function setupCompany(branchId: string, companyId: string) {
  const concepts = [
    {
      code: 'SALARY',
      expression: 'SALARY_BASE * (PERIOD_DAYS / MONTH_DAYS)',
      category: 'ASSIGNMENT',
    },
    {
      code: 'UTIL_ALLOWANCE',
      expression: '(DIAS_UTILIDADES * (SALARY_NORMAL / MONTH_DAYS)) / 360',
      category: 'INFORMATIVE',
    },
    {
      code: 'BONUS_ALLOWANCE',
      expression: '(DIAS_BONO_VACACIONAL * (SALARY_NORMAL / MONTH_DAYS)) / 360',
      category: 'INFORMATIVE',
    },
    { code: 'SSO_EMP', expression: 'BASE_IVSS * SSO_EMP / 100', category: 'DEDUCTION' },
  ];

  for (const concept of concepts) {
    await testDb.insert(payrollConceptTypes).values({
      companyId,
      code: concept.code,
      name: concept.code,
      category: concept.category,
      kind: 'FORMULA',
      expression: concept.expression,
      affectsIntegralSalary:
        concept.code === 'UTIL_ALLOWANCE' || concept.code === 'BONUS_ALLOWANCE',
      isSalarial: concept.code !== 'CESTATICKET',
      isSystem: true,
      branchId: null,
    });
  }

  const settings: Array<[string, string, string]> = [
    ['SSO_EMP', '4', 'PERCENT'],
    ['DIAS_UTILIDADES', '30', 'NUMBER'],
    ['DIAS_BONO_VACACIONAL', '7', 'NUMBER'],
    ['DIAS_VACACIONES_BASE', '15', 'NUMBER'],
    ['TOPE_DIAS_VACACIONES_EXTRA', '15', 'NUMBER'],
    ['TOPE_DIAS_BONO_EXTRA', '21', 'NUMBER'],
    ['DIAS_GARANTIA_TRIMESTRE', '15', 'NUMBER'],
    ['DIAS_ADICIONALES_ANIO', '2', 'NUMBER'],
    ['TOPE_DIAS_ADICIONALES', '30', 'NUMBER'],
    ['TOPE_UTILIDADES_MESES', '4', 'NUMBER'],
  ];

  for (const [key, value, type] of settings) {
    await testDb.insert(payrollSettings).values({
      companyId,
      key,
      label: key,
      value,
      type,
      branchId: null,
      effectiveFrom: EFFECTIVE_FROM,
      isActive: true,
    });
  }

  return branchId;
}

async function createEmployee(branchId: string, baseSalary: number, currencyId: string) {
  const [employee] = await testDb
    .insert(employees)
    .values({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      identityCard: `V-${faker.string.numeric(8)}`,
      branchId,
      baseSalary: String(baseSalary),
      salaryCurrencyId: currencyId,
      payFrequency: 'MONTHLY',
      status: 'ACTIVE',
      hireDate: HIRE_DATE,
    })
    .returning();

  return employee;
}

async function scenario() {
  const branch = await createTestBranch();
  await setupCompany(branch.id, branch.companyId);
  const currency = await baseCurrency();
  const employee = await createEmployee(branch.id, 10_000, currency.id);

  return { branch, employee, currency };
}

describe('Vacaciones (T-02-04)', () => {
  it('calcula los días por antigüedad sobre el salario normal diario', async () => {
    const { branch, employee } = await scenario();

    const summary = await hr.getVacationSummary(employee.id, branch.id, AS_OF);

    expect(summary.years).toBe(3);
    expect(summary.vacationDays).toBe(17);
    expect(summary.bonusDays).toBe(9);
    expect(summary.normalDaily).toBeCloseTo(333.333333, 4);
  });

  it('registra el período y paga vacaciones más bono', async () => {
    const { branch, employee } = await scenario();

    const result = await hr.registerVacation(
      employee.id,
      { year: 2026, days: 15, startDate: '2026-11-02' },
      branch.id
    );

    expect(result.vacationAmount).toBeCloseTo(5_000, 2);
    expect(result.bonusAmount).toBeCloseTo(3_000, 2);

    const [row] = await testDb
      .select()
      .from(employeeVacations)
      .where(eq(employeeVacations.employeeId, employee.id));
    expect(row.totalDays).toBe(17);
    expect(row.daysPending).toBe(2);
    expect(Number(row.amount)).toBeCloseTo(8_000, 2);
  });

  it('no deja registrar dos veces el mismo año', async () => {
    const { branch, employee } = await scenario();
    await hr.registerVacation(employee.id, { year: 2026, days: 5 }, branch.id);

    await expect(
      hr.registerVacation(employee.id, { year: 2026, days: 5 }, branch.id)
    ).rejects.toThrow(/Ya existe el período vacacional/);
  });

  it('rechaza tomar más días de los que corresponden', async () => {
    const { branch, employee } = await scenario();

    await expect(
      hr.registerVacation(employee.id, { year: 2026, days: 30 }, branch.id)
    ).rejects.toThrow(/17 días de vacaciones/);
  });

  it('no expone vacaciones de otra sucursal', async () => {
    const { employee } = await scenario();
    const other = await createTestBranch();

    await expect(hr.getVacationSummary(employee.id, other.id, AS_OF)).rejects.toThrow(
      /Employee .* not found/
    );
  });
});

describe('Prestaciones (T-02-04)', () => {
  it('toma el salario integral del motor de nómina', async () => {
    const { branch, employee } = await scenario();

    const summary = await hr.getBenefitsSummary(employee.id, branch.id, AS_OF);

    expect(summary.integralDaily).toBeCloseTo(367.592592, 5);
    expect(summary.quartersDeposited).toBe(0);
    expect(summary.guaranteeAccumulated).toBe(0);
    expect(summary.retroactive).toBeCloseTo(33_083.33, 2);
    expect(summary.modality).toBe('RETROACTIVE');
  });

  it('deposita la garantía trimestral y la acumula', async () => {
    const { branch, employee } = await scenario();

    const afterDeposit = await hr.depositBenefitGuarantee(
      employee.id,
      { year: 2026, quarter: 4 },
      branch.id
    );

    expect(afterDeposit.quartersDeposited).toBe(1);
    expect(afterDeposit.guaranteeAccumulated).toBeCloseTo(5_513.89, 2);

    const [row] = await testDb
      .select()
      .from(employeeBenefits)
      .where(eq(employeeBenefits.employeeId, employee.id));
    expect(row.days).toBe(15);
    expect(row.type).toBe('GARANTIA');
    expect(Number(row.accumulatedAmount)).toBeCloseTo(5_513.89, 2);
  });

  it('suma los días adicionales en el trimestre del aniversario', async () => {
    const { branch, employee } = await scenario();

    const afterDeposit = await hr.depositBenefitGuarantee(
      employee.id,
      { year: 2026, quarter: 1, isAnniversaryQuarter: true },
      branch.id
    );

    expect(afterDeposit.guaranteeAccumulated).toBeCloseTo(6_984.26, 2);
  });

  it('no deja depositar dos veces el mismo trimestre (RN-13)', async () => {
    const { branch, employee } = await scenario();
    await hr.depositBenefitGuarantee(employee.id, { year: 2026, quarter: 2 }, branch.id);

    await expect(
      hr.depositBenefitGuarantee(employee.id, { year: 2026, quarter: 2 }, branch.id)
    ).rejects.toThrow(/ya está depositada/);
  });

  it('acumula varios trimestres', async () => {
    const { branch, employee } = await scenario();
    await hr.depositBenefitGuarantee(employee.id, { year: 2026, quarter: 2 }, branch.id);
    const after = await hr.depositBenefitGuarantee(
      employee.id,
      { year: 2026, quarter: 3 },
      branch.id
    );

    expect(after.quartersDeposited).toBe(2);
    expect(after.guaranteeAccumulated).toBeCloseTo(11_027.78, 2);
  });
});

describe('Utilidades (T-02-04)', () => {
  it('paga los días mínimos con el ejercicio completo', async () => {
    const { branch, employee } = await scenario();

    const result = await hr.registerProfitSharing(
      employee.id,
      { year: 2025, monthsWorked: 12 },
      branch.id
    );

    expect(result.days).toBe(30);
    expect(result.amount).toBeCloseTo(10_000, 2);
  });

  it('paga proporcional con fracción de año', async () => {
    const { branch, employee } = await scenario();

    const result = await hr.registerProfitSharing(
      employee.id,
      { year: 2025, monthsWorked: 4 },
      branch.id
    );

    expect(result.days).toBe(10);
    expect(result.amount).toBeCloseTo(3_333.33, 2);
  });

  it('no deja registrar dos veces el mismo ejercicio', async () => {
    const { branch, employee } = await scenario();
    await hr.registerProfitSharing(employee.id, { year: 2025, monthsWorked: 12 }, branch.id);

    await expect(
      hr.registerProfitSharing(employee.id, { year: 2025, monthsWorked: 6 }, branch.id)
    ).rejects.toThrow(/ya están registradas/);
  });

  it('guarda la fila en el histórico del empleado', async () => {
    const { branch, employee } = await scenario();
    await hr.registerProfitSharing(employee.id, { year: 2025, monthsWorked: 12 }, branch.id);

    const [row] = await testDb
      .select()
      .from(employeeProfitSharing)
      .where(
        and(eq(employeeProfitSharing.employeeId, employee.id), eq(employeeProfitSharing.year, 2025))
      );

    expect(row.daysToPay).toBe(30);
    expect(Number(row.amount)).toBeCloseTo(10_000, 2);
    expect(row.status).toBe('PENDING');
  });
});

describe('Aislamiento de la configuración (T-02-04)', () => {
  it('usa los parámetros de la empresa del empleado', async () => {
    const branch = await createTestBranch();
    await setupCompany(branch.id, branch.companyId);
    const currency = await baseCurrency();
    const employee = await createEmployee(branch.id, 10_000, currency.id);

    // Cambiar el parámetro cambia el cálculo: la configuración no está hardcodeada.
    await testDb
      .update(payrollSettings)
      .set({ value: '20' })
      .where(
        and(
          eq(payrollSettings.companyId, branch.companyId),
          eq(payrollSettings.key, 'DIAS_UTILIDADES'),
          isNull(payrollSettings.branchId)
        )
      );

    const result = await hr.registerProfitSharing(
      employee.id,
      { year: 2025, monthsWorked: 12 },
      branch.id
    );

    expect(result.days).toBe(20);
  });
});
