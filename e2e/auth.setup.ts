import { test as setup, expect } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'test-admin@test.local';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Test1234!';

const STORAGE = 'e2e/.auth/user.json';

/**
 * Inicia sesión una sola vez y guarda la cookie de sesión (`T-00-12`).
 *
 * `/v1/auth/login` tiene un límite de 5 intentos por minuto y por IP, así que la suite no puede
 * loguearse en cada spec: se hace aquí y las demás pruebas reutilizan el estado.
 */
setup('iniciar sesión', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.context().storageState({ path: STORAGE });
});
