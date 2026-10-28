import { test, expect, type Page } from '@playwright/test';

/**
 * Desgravámenes de ISLR (`P-30`).
 *
 * El sujeto de prueba es la guía de parámetros: la tabla del Art. 50, los conceptos marcados como
 * desgravables y el simulador, que aplica la misma aritmética que el motor. Los endpoints se
 * mockean para que el caso no dependa del estado de la base.
 */

const SETTINGS = [
  { key: 'SSO_EMP', value: 4 },
  { key: 'SSO_PAT', value: 10 },
  { key: 'PIE_EMP', value: 0.5 },
  { key: 'PIE_PAT', value: 2 },
  { key: 'FAOV_EMP', value: 1 },
  { key: 'FAOV_PAT', value: 2 },
  { key: 'CESTATICKET_USD', value: 40 },
  { key: 'DIAS_UTILIDADES', value: 30 },
  { key: 'TOPE_UTILIDADES_MESES', value: 4 },
  { key: 'DIAS_VACACIONES_BASE', value: 15 },
  { key: 'DIAS_BONO_VACACIONAL', value: 7 },
  { key: 'TOPE_DIAS_VACACIONES_EXTRA', value: 15 },
  { key: 'UNIDAD_TRIBUTARIA', value: 43 },
  { key: 'ISLR_DESCUENTO_UNICO', value: 0 },
].map((setting, index) => ({
  id: `s-${index}`,
  type: 'NUMBER',
  label: setting.key,
  effectiveFrom: '2025-06-02T00:00:00.000Z',
  branchId: null,
  ...setting,
}));

const INCOME_TAX_TABLE = {
  effectiveFrom: '2025-06-02T00:00:00.000Z',
  utValue: 43,
  singleDiscount: 0,
  brackets: [
    { fromUt: 0, toUt: 1000, rate: 0.06, discountUt: 0 },
    { fromUt: 1000, toUt: 1500, rate: 0.09, discountUt: 30 },
    { fromUt: 1500, toUt: 2000, rate: 0.12, discountUt: 75 },
    { fromUt: 2000, toUt: 2500, rate: 0.16, discountUt: 155 },
    { fromUt: 2500, toUt: 3000, rate: 0.2, discountUt: 255 },
    { fromUt: 3000, toUt: 4000, rate: 0.24, discountUt: 375 },
    { fromUt: 4000, toUt: 6000, rate: 0.29, discountUt: 575 },
    { fromUt: 6000, toUt: null, rate: 0.34, discountUt: 875 },
  ],
};

/** Aportes del trabajador: `desgravable` decide si restan de la base. */
const CONCEPTS = ['SSO_EMP', 'PIE_EMP', 'FAOV_EMP'].map((code, index) => ({
  id: `c-${index}`,
  code,
  name: code,
  category: 'DEDUCTION',
  kind: 'FORMULA',
  expression: 'BASE_IVSS * SSO_EMP / 100',
  affectsIntegralSalary: false,
  isSalarial: true,
  reducesIncomeTaxBase: code === 'SSO_EMP',
  isSystem: true,
  branchId: null,
}));

async function mockPayrollParameters(page: Page, desgravables: string[]) {
  const concepts = CONCEPTS.map(concept => ({
    ...concept,
    reducesIncomeTaxBase: desgravables.includes(concept.code),
  }));

  await page.route('**/v1/hr/settings**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) })
  );
  await page.route('**/v1/hr/income-tax-table**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(INCOME_TAX_TABLE),
    })
  );
  await page.route('**/v1/hr/concept-types**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(concepts) })
  );
}

async function openGuide(page: Page, salary = '10000') {
  await page.goto('/dashboard/settings/payroll-guide');

  const simulator = page.getByTestId('payroll-simulator');
  await expect(simulator).toBeVisible({ timeout: 20_000 });
  await page.locator('#sim-salary').fill(salary);

  return simulator;
}

test.describe('Desgravámenes de ISLR (P-30)', () => {
  test('resta los aportes marcados antes de aplicar la tarifa', async ({ page }) => {
    await mockPayrollParameters(page, ['SSO_EMP', 'PIE_EMP', 'FAOV_EMP']);

    const simulator = await openGuide(page);

    // 10.000 − (400 + 50 + 100) = 9.450 de base → 113.400 anuales.
    // 113.400 / 43 = 2.637,21 UT → 20 % − 255 UT → 11.715 anuales → 976,25 al mes.
    await expect(simulator.getByText(/desgravables \(Bs\.S\s*550,00 al mes\)/)).toBeVisible();
    await expect(simulator.getByText('ISLR estimado del mes')).toBeVisible();
    await expect(simulator.getByText(/^−?Bs\.S\s*976,25$/)).toBeVisible();
    await expect(simulator.getByText(/^−?Bs\.S\s*1\.086,25$/)).toHaveCount(0);
  });

  test('sin conceptos marcados retiene sobre el salario completo', async ({ page }) => {
    await mockPayrollParameters(page, []);

    const simulator = await openGuide(page);

    // Base completa: 120.000 anuales → 2.790,70 UT → 20 % − 255 UT → 1.086,25 al mes.
    await expect(simulator.getByText(/desgravables \(Bs\.S\s*0,00 al mes\)/)).toBeVisible();
    await expect(simulator.getByText(/^−?Bs\.S\s*1\.086,25$/)).toBeVisible();
  });

  test('la tarifa vigente se muestra con sus ocho tramos', async ({ page }) => {
    await mockPayrollParameters(page, ['SSO_EMP']);

    await openGuide(page);

    await expect(page.getByTestId('guide-islr')).toContainText('8 tramos');
    await expect(page.getByTestId('guide-islr')).toContainText('6000–∞ UT · 34 % − 875 UT');
  });
});
