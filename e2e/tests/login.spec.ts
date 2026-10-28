import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'test-admin@test.local';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Test1234!';

// Este spec prueba el propio formulario de login: arranca sin la sesión guardada.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login E2E Tests', () => {
  test('should load login page and show form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#email').fill(EMAIL);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});
