import { test, expect, type Page } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';

type Branch = { id: string; name: string; companyId: string };

/**
 * Aislamiento por sucursal de punta a punta (`T-00-12`, `S-00`).
 *
 * Las capas 1 y 2 viven en `apps/backend/src/test/branch-isolation.test.ts` (servicio) y en el
 * resto de `src/test` (HTTP contra Postgres). Esta es la tercera: el mismo usuario, con acceso a
 * dos sucursales, no ve el documento de la otra ni por API ni en pantalla.
 *
 * La sesión viene de `e2e/auth.setup.ts` como cookie httpOnly, así que `page.request` ya está
 * autenticado y no hace falta un login por API (`/auth/login` admite 5 intentos por minuto).
 */
async function twoBranches(page: Page) {
  const response = await page.request.get(`${API_URL}/v1/branches`);
  expect(response.ok()).toBeTruthy();
  const branches = (await response.json()) as Branch[];
  expect(branches.length, 'el usuario E2E necesita al menos dos sucursales').toBeGreaterThan(1);

  return { a: branches[0], b: branches[1] };
}

/** Factura en borrador (no es obligación ni entra en libros): el código lo asigna el backend. */
async function createDraftInvoice(page: Page, branchId: string) {
  const headers = { 'x-branch-id': branchId };
  const [partners, products, currencies] = await Promise.all([
    page.request.get(`${API_URL}/v1/partners`, { headers }),
    page.request.get(`${API_URL}/v1/products`, { headers }),
    page.request.get(`${API_URL}/v1/settings/currencies`, { headers }),
  ]);

  expect(partners.ok()).toBeTruthy();
  expect(products.ok()).toBeTruthy();
  expect(currencies.ok()).toBeTruthy();

  const partnerList = await partners.json();
  const productList = await products.json();
  const currencyList = await currencies.json();
  const baseCurrency = currencyList.find((currency: { isBase: boolean }) => currency.isBase);

  const response = await page.request.post(`${API_URL}/v1/billing/invoices`, {
    headers,
    data: {
      partnerId: partnerList[0].id,
      branchId,
      currencyId: baseCurrency.id,
      type: 'SALE',
      items: [{ productId: productList[0].id, quantity: 1, price: 10, taxRate: 0 }],
    },
  });
  const body = await response.text();
  expect(response.ok(), body).toBeTruthy();

  return JSON.parse(body) as { id: string; code: string };
}

async function codesInBranch(page: Page, branchId: string) {
  const response = await page.request.get(
    `${API_URL}/v1/billing/invoices?paginated=true&limit=100`,
    { headers: { 'x-branch-id': branchId } }
  );
  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  return body.data.map((row: { code: string }) => row.code) as string[];
}

/**
 * Cambia el contexto activo por el selector de empresa.
 *
 * En el seed de pruebas cada empresa tiene una sola sucursal, así que el selector de sucursal está
 * deshabilitado; el de empresa no, y al cambiarlo el contexto salta a su primera sucursal.
 */
async function switchCompany(page: Page, optionIndex: number) {
  const selector = page
    .getByRole('combobox')
    .filter({ hasText: /Empresa|Company/ })
    .first();
  await selector.click();
  // Las opciones del `Combobox` son botones dentro del popover, no `role="option"`.
  const options = page.locator('[data-radix-popper-content-wrapper] button[type="button"]');
  await options.nth(optionIndex).click();
  await expect(options).toHaveCount(0);
}

test.describe('Aislamiento entre sucursales (T-00-12)', () => {
  test('el documento de una sucursal no se ve desde la otra', async ({ page }) => {
    const { a, b } = await twoBranches(page);

    const invoice = await createDraftInvoice(page, a.id);

    // Capa HTTP: el listado y el detalle respetan la cabecera de sucursal.
    expect(await codesInBranch(page, a.id)).toContain(invoice.code);
    expect(await codesInBranch(page, b.id)).not.toContain(invoice.code);

    const detailFromB = await page.request.get(`${API_URL}/v1/billing/invoices/${invoice.id}`, {
      headers: { 'x-branch-id': b.id },
    });
    expect(detailFromB.status()).toBe(404);

    // Capa UI: el documento aparece con la sucursal A activa y desaparece al cambiar de contexto.
    const companiesResponse = await page.request.get(`${API_URL}/v1/branches/companies`);
    const companies = (await companiesResponse.json()) as Array<{ id: string }>;
    const indexOfCompany = (companyId: string) => {
      const index = companies.findIndex(company => company.id === companyId);
      expect(index, `la empresa ${companyId} debe estar en el selector`).toBeGreaterThanOrEqual(0);
      return index;
    };

    await page.goto('/dashboard');
    await switchCompany(page, indexOfCompany(a.companyId));
    await page.goto('/dashboard/operations/sales');
    await expect(page.getByText(invoice.code)).toBeVisible({ timeout: 20_000 });

    await switchCompany(page, indexOfCompany(b.companyId));
    await page.goto('/dashboard/operations/sales');
    await expect(page.getByText(invoice.code)).toHaveCount(0, { timeout: 20_000 });
  });
});
