import { test, expect, type Page } from '@playwright/test';

/**
 * Anulación de nómina (`P-29`, RN-21).
 *
 * El sujeto de prueba es la pantalla del run: un run anulado no se paga ni se contabiliza, deja
 * constancia del motivo y la acción pide una razón antes de ejecutarse. La API se mockea para que el
 * caso no dependa de qué nóminas existan en la base.
 */

const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const LINE = {
  conceptCode: 'SALARY',
  conceptName: 'Sueldo del período',
  category: 'ASSIGNMENT',
  base: 365000,
  rate: 1,
  amount: 365000,
};

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    code: 'NOM-000099',
    branchId: '00000000-0000-4000-8000-000000000010',
    frequency: 'MONTHLY',
    currencyId: '00000000-0000-4000-8000-000000000021',
    startDate: '2027-01-01T00:00:00.000Z',
    endDate: '2027-01-31T00:00:00.000Z',
    totalAmount: 365000,
    status: 'PROCESSED',
    voidedAt: null,
    voidReason: null,
    items: [
      {
        id: 'item-1',
        employeeId: 'emp-1',
        employeeName: 'Ana Rodriguez',
        baseAmount: 365000,
        bonuses: 0,
        deductions: 0,
        netTotal: 365000,
        lines: [LINE],
      },
    ],
    ...overrides,
  };
}

/** Sirve el run y permite cambiar de estado tras la anulación (como haría la API real). */
async function mockRun(page: Page, initial: Record<string, unknown>) {
  let current = initial;

  await page.route(`**/v1/hr/payroll/${RUN_ID}/parameters`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/v1/treasury/methods', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route(`**/v1/hr/payroll/${RUN_ID}/void`, async route => {
    const body = route.request().postDataJSON() as { reason: string };
    current = {
      ...current,
      status: 'VOID',
      voidReason: body.reason,
      voidedAt: '2027-02-01T10:00:00.000Z',
    };
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(current),
    });
  });
  await page.route(`**/v1/hr/payroll/${RUN_ID}`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) })
  );
}

test.describe('Anulación de nómina (P-29)', () => {
  test('un run anulado no se paga ni se contabiliza y muestra el motivo', async ({ page }) => {
    await mockRun(
      page,
      run({
        status: 'VOID',
        voidReason: 'Se pagó el sueldo equivocado',
        voidedAt: '2027-02-01T10:00:00.000Z',
      })
    );

    await page.goto(`/dashboard/hr/payroll/${RUN_ID}`);

    await expect(page.getByText('Anulada', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Nómina anulada/)).toBeVisible();
    await expect(page.getByText(/Se pagó el sueldo equivocado/)).toBeVisible();

    await expect(page.getByRole('button', { name: 'Contabilizar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pagar nómina' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Anular nómina' })).toHaveCount(0);
  });

  test('la anulación exige un motivo y deja el run anulado', async ({ page }) => {
    await mockRun(page, run());

    await page.goto(`/dashboard/hr/payroll/${RUN_ID}`);
    await page.getByRole('button', { name: 'Anular nómina' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const confirm = dialog.getByRole('button', { name: 'Anular nómina' });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel('Motivo de la anulación').fill('Sueldo equivocado del período');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByText('Anulada', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Sueldo equivocado del período/)).toBeVisible();
  });

  test('un borrador no ofrece anular: se descarta antes de procesarlo', async ({ page }) => {
    await mockRun(page, run({ status: 'DRAFT' }));

    await page.goto(`/dashboard/hr/payroll/${RUN_ID}`);

    await expect(page.getByRole('button', { name: 'Pagar nómina' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Anular nómina' })).toHaveCount(0);
  });
});
