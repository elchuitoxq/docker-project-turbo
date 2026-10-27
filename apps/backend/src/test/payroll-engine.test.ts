import { describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { testDb } from './database';
import { createTestBranch, createTestCurrency } from './factories';
import {
  currencies,
  employees,
  exchangeRates,
  payrollConceptTypes,
  payrollItems,
  payrollItemLines,
  payrollRuns,
  payrollSettings,
} from '../schema';
import { HrService } from '../modules/hr/services/hr.service';
import { PayrollCalculator } from '../modules/hr/payroll/payroll.calculator';

/**
 * Motor de nómina de punta a punta (`T-02-03`) contra Postgres real.
 *
 * A diferencia de `payroll.calculator.test.ts` (que prueba la aritmética aislada), aquí se verifica
 * el cableado completo: parámetros congelados del run → catálogo de la empresa → motor → líneas
 * persistidas. Incluye la conversión de moneda que corregía H-62.
 */

const EFFECTIVE_FROM = new Date('2020-01-01T00:00:00.000Z');

interface Catalog {
  code: string;
  name: string;
  category: string;
  expression: string | null;
  affectsIntegralSalary?: boolean;
  isSalarial?: boolean;
}

const CATALOG: Catalog[] = [
  {
    code: 'SALARY',
    name: 'Sueldo del período',
    category: 'ASSIGNMENT',
    expression: 'SALARY_BASE * (PERIOD_DAYS / MONTH_DAYS)',
    affectsIntegralSalary: true,
  },
  {
    code: 'CESTATICKET',
    name: 'Cestaticket',
    category: 'ASSIGNMENT',
    expression: 'CESTATICKET_USD',
    isSalarial: false,
  },
  {
    code: 'SSO_EMP',
    name: 'Seguro social trabajador',
    category: 'DEDUCTION',
    expression: 'BASE_IVSS * SSO_EMP / 100',
  },
  {
    code: 'PIE_EMP',
    name: 'Paro forzoso trabajador',
    category: 'DEDUCTION',
    expression: 'BASE_PARO * PIE_EMP / 100',
  },
  {
    code: 'FAOV_EMP',
    name: 'FAOV trabajador',
    category: 'DEDUCTION',
    expression: 'BASE_FAOV * FAOV_EMP / 100',
  },
  {
    code: 'SSO_PAT',
    name: 'Seguro social patronal',
    category: 'EMPLOYER_CONTRIBUTION',
    expression: 'BASE_IVSS * SSO_PAT / 100',
  },
  {
    code: 'UTIL_ALLOWANCE',
    name: 'Alícuota de utilidades',
    category: 'INFORMATIVE',
    expression: '(DIAS_UTILIDADES * (SALARY_NORMAL / MONTH_DAYS)) / 360',
    affectsIntegralSalary: true,
  },
  {
    code: 'BONUS_ALLOWANCE',
    name: 'Alícuota de bono vacacional',
    category: 'INFORMATIVE',
    expression: '(DIAS_BONO_VACACIONAL * (SALARY_NORMAL / MONTH_DAYS)) / 360',
    affectsIntegralSalary: true,
  },
  {
    code: 'BENEFIT_GUARANTEE',
    name: 'Garantía trimestral',
    category: 'INFORMATIVE',
    expression: 'SALARY_INTEGRAL * DIAS_GARANTIA_TRIMESTRE',
  },
];

const SETTINGS: Array<{ key: string; value: string; type: string }> = [
  { key: 'SSO_EMP', value: '4', type: 'PERCENT' },
  { key: 'SSO_PAT', value: '10', type: 'PERCENT' },
  { key: 'PIE_EMP', value: '0.5', type: 'PERCENT' },
  { key: 'FAOV_EMP', value: '1', type: 'PERCENT' },
  { key: 'CESTATICKET_USD', value: '0', type: 'MONEY_USD' },
  { key: 'DIAS_UTILIDADES', value: '30', type: 'NUMBER' },
  { key: 'DIAS_BONO_VACACIONAL', value: '7', type: 'NUMBER' },
  { key: 'DIAS_GARANTIA_TRIMESTRE', value: '15', type: 'NUMBER' },
];

async function baseCurrency() {
  const [currency] = await testDb
    .select()
    .from(currencies)
    .where(eq(currencies.isBase, true))
    .limit(1);
  if (!currency) throw new Error('No base currency configured');
  return currency;
}

/**
 * El parámetro `CESTATICKET_USD` se convierte contra la moneda real `USD`, así que la prueba la
 * necesita con una tasa para la fecha del período. Se reutiliza si ya existe.
 */
async function ensureUsdWithRate(rate: string) {
  const [existing] = await testDb
    .select()
    .from(currencies)
    .where(eq(currencies.code, 'USD'))
    .limit(1);

  const usd =
    existing ??
    (
      await testDb
        .insert(currencies)
        .values({ code: 'USD', name: 'US Dollar', symbol: '$', isBase: false })
        .returning()
    )[0];

  const date = new Date('2026-10-01T00:00:00.000Z');
  await testDb
    .insert(exchangeRates)
    .values({ currencyId: usd.id, rate, date, source: 'BCV' })
    .onConflictDoUpdate({
      target: [exchangeRates.currencyId, exchangeRates.date],
      set: { rate },
    });

  return usd;
}

async function seedCompanyCatalog(companyId: string, overrideKey?: [string, string]) {
  for (const concept of CATALOG) {
    await testDb.insert(payrollConceptTypes).values({
      companyId,
      code: concept.code,
      name: concept.name,
      category: concept.category,
      kind: concept.expression ? 'FORMULA' : 'FIXED',
      expression: concept.expression,
      affectsIntegralSalary: concept.affectsIntegralSalary ?? false,
      isSalarial: concept.isSalarial ?? true,
      isSystem: true,
      branchId: null,
    });
  }

  for (const setting of SETTINGS) {
    const value = overrideKey && overrideKey[0] === setting.key ? overrideKey[1] : setting.value;
    await testDb.insert(payrollSettings).values({
      companyId,
      key: setting.key,
      label: setting.key,
      value,
      type: setting.type,
      branchId: null,
      effectiveFrom: EFFECTIVE_FROM,
      isActive: true,
    });
  }
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
      hireDate: new Date('2024-01-15'),
    })
    .returning();

  return employee;
}

async function runPayroll(branchId: string, currencyId: string) {
  const hr = new HrService(new PayrollCalculator());

  return hr.generatePayroll(
    {
      branchId,
      frequency: 'MONTHLY',
      currencyId,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    } as never,
    '00000000-0000-4000-8000-0000000000bb'
  );
}

async function itemOf(runId: string, employeeId: string) {
  const [item] = await testDb
    .select()
    .from(payrollItems)
    .where(and(eq(payrollItems.runId, runId), eq(payrollItems.employeeId, employeeId)))
    .limit(1);
  if (!item) throw new Error('Payroll item not found');

  const lines = await testDb
    .select()
    .from(payrollItemLines)
    .where(eq(payrollItemLines.itemId, item.id));

  return { item, lines };
}

describe('Motor de nómina de punta a punta', () => {
  it('genera el recibo del caso dorado con las líneas separadas por naturaleza', async () => {
    const branch = await createTestBranch();
    await seedCompanyCatalog(branch.companyId);
    const currency = await baseCurrency();
    const employee = await createEmployee(branch.id, 10_000, currency.id);

    const run = await runPayroll(branch.id, currency.id);
    const { item, lines } = await itemOf(run.id, employee.id);

    expect(Number(item.baseAmount)).toBeCloseTo(10_000, 2);
    expect(Number(item.deductions)).toBeCloseTo(550, 2);
    expect(Number(item.netTotal)).toBeCloseTo(9_450, 2);
    expect(run.totalAmount).toBeCloseTo(9_450, 2);

    const byCode = new Map(lines.map(line => [line.conceptCode, line]));
    expect(Number(byCode.get('SSO_EMP')?.amount)).toBeCloseTo(400, 2);
    expect(Number(byCode.get('PIE_EMP')?.amount)).toBeCloseTo(50, 2);
    expect(Number(byCode.get('FAOV_EMP')?.amount)).toBeCloseTo(100, 2);
    expect(Number(byCode.get('BENEFIT_GUARANTEE')?.amount)).toBeCloseTo(5_513.89, 2);

    // H-63: el aporte patronal se registra y no toca el neto.
    expect(byCode.get('SSO_PAT')?.category).toBe('EMPLOYER_CONTRIBUTION');
    expect(Number(byCode.get('SSO_PAT')?.amount)).toBeCloseTo(1_000, 2);
    expect(Number(byCode.get('UTIL_ALLOWANCE')?.amount)).toBeCloseTo(27.78, 2);
  });

  it('congela los parámetros del run y no los altera al cambiarlos después (RN-22)', async () => {
    const branch = await createTestBranch();
    await seedCompanyCatalog(branch.companyId);
    const currency = await baseCurrency();
    const employee = await createEmployee(branch.id, 10_000, currency.id);

    const run = await runPayroll(branch.id, currency.id);

    await testDb
      .update(payrollSettings)
      .set({ value: '20' })
      .where(
        and(
          eq(payrollSettings.companyId, branch.companyId),
          eq(payrollSettings.key, 'SSO_EMP'),
          isNull(payrollSettings.branchId)
        )
      );

    const { item } = await itemOf(run.id, employee.id);
    expect(Number(item.deductions)).toBeCloseTo(550, 2);
  });

  it('convierte el sueldo de un empleado en divisa a la moneda del run (H-62)', async () => {
    const branch = await createTestBranch();
    const usd = await ensureUsdWithRate('36.5');
    const ves = await baseCurrency();

    await seedCompanyCatalog(branch.companyId);
    const employee = await createEmployee(branch.id, 100, usd.id);

    const run = await runPayroll(branch.id, ves.id);
    const { item } = await itemOf(run.id, employee.id);

    expect(Number(item.baseAmount)).toBeCloseTo(3_650, 2);
    expect(Number(item.deductions)).toBeCloseTo(200.75, 2);
  });

  it('convierte el cestaticket en divisa antes de pagarlo (H-62)', async () => {
    const branch = await createTestBranch();
    await ensureUsdWithRate('36.5');
    const ves = await baseCurrency();

    await seedCompanyCatalog(branch.companyId, ['CESTATICKET_USD', '40']);
    const employee = await createEmployee(branch.id, 10_000, ves.id);

    const run = await runPayroll(branch.id, ves.id);
    const { item, lines } = await itemOf(run.id, employee.id);

    const cestaticket = lines.find(line => line.conceptCode === 'CESTATICKET');
    expect(Number(cestaticket?.amount)).toBeCloseTo(1_460, 2);
    // El cestaticket no es salarial: no cambia las deducciones.
    expect(Number(item.deductions)).toBeCloseTo(550, 2);
    expect(Number(item.netTotal)).toBeCloseTo(10_910, 2);
  });

  it('no deja un run huérfano si el cálculo falla', async () => {
    const branch = await createTestBranch();
    await seedCompanyCatalog(branch.companyId);
    const ves = await baseCurrency();
    await createEmployee(branch.id, 10_000, ves.id);

    // Moneda de nómina sin tasa registrada: el conversor falla y el run no debe quedar.
    const sinTasa = await createTestCurrency();

    await expect(runPayroll(branch.id, sinTasa.id)).rejects.toThrow(/tasa de cambio/);

    const runs = await testDb.select().from(payrollRuns).where(eq(payrollRuns.branchId, branch.id));

    expect(runs).toHaveLength(0);
  });

  it('no genera items cuando la sucursal no tiene empleados activos', async () => {
    const branch = await createTestBranch();
    const currency = await baseCurrency();

    const run = await runPayroll(branch.id, currency.id);
    const items = await testDb.select().from(payrollItems).where(eq(payrollItems.runId, run.id));

    expect(items).toHaveLength(0);
    expect(await testDb.select().from(payrollRuns).where(eq(payrollRuns.id, run.id))).toHaveLength(
      1
    );
  });
});
