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
 * Cambia la sucursal activa por el selector de sucursal.
 *
 * El test se llama «aislamiento entre sucursales», así que lo que se cambia es la **sucursal**. Se
 * elige por nombre y no por posición: el orden del selector no es el mismo que el de la API. Cuando
 * la empresa tiene una sola sucursal el selector está deshabilitado y no hay nada que cambiar.
 */
async function switchBranch(page: Page, branchName: string) {
  const selector = page
    .getByRole('combobox')
    .filter({ hasText: /Sucursal|Branch/ })
    .first();

  if (!(await selector.isEnabled())) return;

  await selector.click();
  await page
    .locator('[data-radix-popper-content-wrapper] button[type="button"]')
    .filter({ hasText: branchName })
    .first()
    .click();
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

    // Capa UI: el documento aparece con la sucursal A activa y desaparece al cambiar de sucursal.
    await page.goto('/dashboard');
    await switchBranch(page, a.name);
    await page.goto('/dashboard/operations/sales');
    await expect(page.getByText(invoice.code)).toBeVisible({ timeout: 20_000 });

    await switchBranch(page, b.name);
    await page.goto('/dashboard/operations/sales');
    await expect(page.getByText(invoice.code)).toHaveCount(0, { timeout: 20_000 });
  });
});
