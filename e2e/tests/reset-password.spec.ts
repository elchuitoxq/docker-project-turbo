import { test, expect } from '@playwright/test';

test.describe('Reset password page', () => {
  test('sin token muestra el mensaje de enlace inválido', async ({ page }) => {
    await page.goto('/reset-password');

    // El route-announcer de Next también usa role="alert": filtramos por texto.
    await expect(
      page.getByRole('alert').filter({ hasText: /inválido|expiró|invalid|expired/i })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /volver|back/i })).toBeVisible();
  });

  test('con token muestra el formulario de nueva contraseña', async ({ page }) => {
    await page.goto('/reset-password?token=abc123');

    await expect(page.locator('#new-password')).toBeVisible();
    await expect(page.locator('#confirm-password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
