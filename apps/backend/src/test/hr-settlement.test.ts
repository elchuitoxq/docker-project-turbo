import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './database';
import { createTestBranch, createTestEmployee, ensureTestBaseCurrency } from './factories';
import { employees, payrollConceptTypes, payrollSettings } from '../schema';
import { HrService } from '../modules/hr/services/hr.service';
import { PayrollCalculator } from '../modules/hr/payroll/payroll.calculator';
import { LaborBenefits } from '../modules/hr/payroll/labor-benefits';

/**
 * Liquidación de egreso (`T-02-05`) contra Postgres real.
 *
 * Escenario: ingreso 2023-01-15, egreso 2026-10-31, sueldo 10.000. Tres años de servicio, fracción
 * de 9 meses (cuenta como año para la indemnización del Art. 92).
 */

const EFFECTIVE_FROM = new Date('2020-01-01T00:00:00.000Z');
const HIRE_DATE = new Date('2023-01-15T00:00:00.000Z');
const TERMINATION = '2026-10-31';

const hr = new HrService(new PayrollCalculator(), undefined, new LaborBenefits());

async function setupBranch() {
  const branch = await createTestBranch();

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
  ];

  for (const concept of concepts) {
    await testDb.insert(payrollConceptTypes).values({
      companyId: branch.companyId,
      code: concept.code,
      name: concept.code,
      category: concept.category,
      kind: 'FORMULA',
      expression: concept.expression,
      affectsIntegralSalary: concept.code !== 'SALARY',
      isSalarial: true,
      isSystem: true,
      branchId: null,
    });
  }

  const settings: Array<[string, string, string]> = [
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
      companyId: branch.companyId,
      key,
      label: key,
      value,
      type,
      branchId: null,
      effectiveFrom: EFFECTIVE_FROM,
      isActive: true,
    });
  }

  const currency = await ensureTestBaseCurrency();
  const employee = await createTestEmployee({
    branchId: branch.id,
    baseSalary: '10000.00',
    salaryCurrencyId: currency.id,
    hireDate: HIRE_DATE,
  });

  return { branch, employee };
}

describe('Liquidación de egreso (T-02-05)', () => {
  it('liquida prestaciones, vacaciones, bono y utilidades en una renuncia', async () => {
    const { branch, employee } = await setupBranch();

    const settlement = await hr.settleEmployee(
      employee.id,
      { terminationDate: TERMINATION, cause: 'RENUNCIA' },
      branch.id
    );

    expect(settlement.years).toBe(3);
    // Los salarios se guardan con dos decimales (numeric(20,2)), no con la precisión de cálculo.
    expect(settlement.integralSalary).toBeCloseTo(367.59, 2);
    expect(settlement.normalSalary).toBeCloseTo(333.33, 2);

    expect(settlement.benefitsModality).toBe('RETROACTIVE');
    expect(settlement.benefitsAmount).toBeCloseTo(33_083.33, 2);

    expect(settlement.vacationDays).toBe(17);
    expect(settlement.vacationAmount).toBeCloseTo(5_666.67, 2);
    expect(settlement.bonusDays).toBe(9);
    expect(settlement.bonusAmount).toBeCloseTo(3_000, 2);

    expect(settlement.profitDays).toBe(25);
    expect(settlement.profitAmount).toBeCloseTo(8_333.33, 2);

    // La renuncia no indemniza.
    expect(settlement.indemnificationDays).toBe(0);
    expect(settlement.indemnificationAmount).toBe(0);

    expect(settlement.totalAmount).toBeCloseTo(50_083.33, 2);
  });

  it('indemniza el despido injustificado con los días del Art. 92', async () => {
    const { branch, employee } = await setupBranch();

    const settlement = await hr.settleEmployee(
      employee.id,
      { terminationDate: TERMINATION, cause: 'DESPIDO_INJUSTIFICADO' },
      branch.id
    );

    // 3 años + fracción de 9 meses = 4 años de antigüedad → 4 × 30 = 120 días (tope 150).
    expect(settlement.indemnificationDays).toBe(120);
    expect(settlement.indemnificationAmount).toBeCloseTo(44_111.11, 2);
    expect(settlement.totalAmount).toBeCloseTo(94_194.44, 2);
  });

  it('marca al empleado como egresado con la causa', async () => {
    const { branch, employee } = await setupBranch();

    await hr.settleEmployee(
      employee.id,
      { terminationDate: TERMINATION, cause: 'MUTUO_ACUERDO' },
      branch.id
    );

    const [row] = await testDb.select().from(employees).where(eq(employees.id, employee.id));
    expect(row.status).toBe('TERMINATED');
    expect(row.terminationReason).toBe('MUTUO_ACUERDO');
    expect(row.terminationDate?.toISOString().slice(0, 10)).toBe(TERMINATION);
  });

  it('no liquida dos veces al mismo empleado (RN-20)', async () => {
    const { branch, employee } = await setupBranch();
    await hr.settleEmployee(
      employee.id,
      { terminationDate: TERMINATION, cause: 'RENUNCIA' },
      branch.id
    );

    await expect(
      hr.settleEmployee(employee.id, { terminationDate: TERMINATION, cause: 'RENUNCIA' }, branch.id)
    ).rejects.toThrow(/ya tiene una liquidación registrada/);
  });

  it('rechaza una causa de egreso que no existe', async () => {
    const { branch, employee } = await setupBranch();

    await expect(
      hr.settleEmployee(employee.id, { terminationDate: TERMINATION, cause: 'ME_FUI' }, branch.id)
    ).rejects.toThrow(/Causa de egreso inválida/);
  });

  it('devuelve 404 si se consulta una liquidación que no existe', async () => {
    const { branch, employee } = await setupBranch();

    await expect(hr.getSettlement(employee.id, branch.id)).rejects.toThrow(
      /no tiene liquidación registrada/
    );
  });

  it('descuenta las vacaciones ya tomadas del pago', async () => {
    const { branch, employee } = await setupBranch();
    await hr.registerVacation(employee.id, { year: 2026, days: 15 }, branch.id);

    const settlement = await hr.settleEmployee(
      employee.id,
      { terminationDate: TERMINATION, cause: 'RENUNCIA' },
      branch.id
    );

    // 17 días de derecho − 15 tomados = 2 pendientes.
    expect(settlement.vacationDays).toBe(2);
    expect(settlement.vacationAmount).toBeCloseTo(666.67, 2);
    // El bono vacacional se paga completo.
    expect(settlement.bonusDays).toBe(9);
  });

  it('no liquida a un empleado de otra sucursal', async () => {
    const { employee } = await setupBranch();
    const other = await createTestBranch();

    await expect(
      hr.settleEmployee(employee.id, { terminationDate: TERMINATION, cause: 'RENUNCIA' }, other.id)
    ).rejects.toThrow(/Employee .* not found/);
  });
});
