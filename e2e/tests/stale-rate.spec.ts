import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'test-admin@test.local';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Test1234!';

/** Fecha local en formato `YYYY-MM-DD` (no UTC: de noche en Venezuela ya es "mañana"). */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const USD_PAYABLE = {
  invoiceId: '11111111-1111-4111-8111-111111111111',
  code: 'FC-USD-0001',
  supplierInvoiceNumber: 'SUP-77',
  partnerId: '22222222-2222-4222-8222-222222222222',
  partnerName: 'Proveedor Dólar CA',
  partnerTaxId: 'J-12345678-9',
  issueDate: daysAgo(10),
  dueDate: daysAgo(-5),
  currencyId: '33333333-3333-4333-8333-333333333333',
  currencyCode: 'USD',
  total: 100,
  paid: 0,
  creditNotes: 0,
  retained: 0,
  balance: 100,
  exchangeRate: 40,
  totalBase: 4000,
  balanceBase: 4000,
  status: 'PENDING',
  daysOverdue: 0,
};

const AGING = {
  branchId: '00000000-0000-4000-8000-000000000010',
  asOf: daysAgo(0),
  baseCurrencyCode: 'VES',
  buckets: [
    { bucket: 'CURRENT', label: 'Por vencer', total: 4000, invoices: 1 },
    { bucket: 'D1_30', label: '1 a 30 días', total: 0, invoices: 0 },
    { bucket: 'D31_60', label: '31 a 60 días', total: 0, invoices: 0 },
    { bucket: 'D61_90', label: '61 a 90 días', total: 0, invoices: 0 },
    { bucket: 'D90_PLUS', label: 'Más de 90 días', total: 0, invoices: 0 },
  ],
  byPartner: [
    {
      partnerId: USD_PAYABLE.partnerId,
      partnerName: USD_PAYABLE.partnerName,
      partnerTaxId: USD_PAYABLE.partnerTaxId,
      total: 4000,
      overdue: 0,
    },
  ],
  totals: { balance: 4000, overdue: 0 },
};

const METHOD = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Transferencia',
  code: 'TRANSFER',
};

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

/** Deja el listado de CxP y las tasas bajo control del test: la tasa vencida es el sujeto de prueba. */
async function mockPayables(page: Page, rateDate: string) {
  await page.route('**/v1/billing/invoices/payables**', route => {
    const body = route.request().url().includes('/aging') ? AGING : [USD_PAYABLE];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.route('**/v1/treasury/methods', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([METHOD]) })
  );
  await page.route('**/v1/settings/currencies/rates/latest', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'r-1', rate: 40, date: rateDate, source: 'BCV', currencyCode: 'VES' },
        { id: 'r-2', rate: 1, date: rateDate, source: 'BCV', currencyCode: 'USD' },
      ]),
    })
  );
}

async function openPaymentDialog(page: Page) {
  await page.goto('/dashboard/finance/payables');
  await expect(page.getByText('FC-USD-0001')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Pagar/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // El método de pago es obligatorio: sin él el botón estaría deshabilitado por otra razón.
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Transferencia' }).click();

  return dialog;
}

test.describe('Tasa vencida en cuentas por pagar (T-08-12)', () => {
  test('bloquea el pago hasta confirmar la tasa vieja', async ({ page }) => {
    await login(page);
    await mockPayables(page, daysAgo(5));

    const dialog = await openPaymentDialog(page);

    await expect(dialog.getByTestId('stale-rate-gate')).toBeVisible();
    await expect(dialog.getByText(/hace 5 días/)).toBeVisible();

    const submit = dialog.getByRole('button', { name: 'Registrar pago' });
    await expect(submit).toBeDisabled();

    // Confirmar la tasa es lo único que falta para poder emitir.
    await dialog.getByLabel('Confirmar tasa vencida').click();
    await expect(submit).toBeEnabled();
  });

  test('con la tasa del día no pide confirmación y muestra el monto dual', async ({ page }) => {
    await login(page);
    await mockPayables(page, daysAgo(0));

    const dialog = await openPaymentDialog(page);

    await expect(dialog.getByTestId('stale-rate-gate')).toHaveCount(0);
    // 100 USD × 40 = 4.000 VES
    await expect(dialog.getByTestId('pay-dual')).toContainText('4.000,00');
    await expect(dialog.getByRole('button', { name: 'Registrar pago' })).toBeEnabled();
  });
});
