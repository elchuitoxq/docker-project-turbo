import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';

// Este spec prueba el estado sin sesión (login visible y API sin credenciales): arranca limpio.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Aplicación Frontend', () => {
  test('debería cargar la página de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });
});

test.describe('API Backend', () => {
  test('los endpoints protegidos rechazan peticiones sin token', async ({ request }) => {
    const response = await request.get(`${API_URL}/v1/users`);
    expect(response.status()).toBe(401);
  });

  test('el healthcheck responde ok', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
