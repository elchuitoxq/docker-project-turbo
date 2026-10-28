import { test, expect, type Page } from '@playwright/test';

/**
 * «Olvidé mi contraseña» (`P-23`).
 *
 * La API responde siempre lo mismo exista o no la cuenta; el enlace directo (`mockUrl`) sólo llega
 * fuera de producción. Las dos cosas se prueban mockeando la respuesta, porque el comportamiento no
 * depende del estado de la base.
 */

// Estas pruebas necesitan llegar al login **sin sesión**: el proyecto `chromium` trae la cookie del
// `auth.setup` y `/login` redirige al panel cuando ya hay una.
test.use({ storageState: { cookies: [], origins: [] } });

async function mockForgot(page: Page, body: unknown, status = 200) {
  await page.route('**/v1/auth/forgot-password', route =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  );
}

test.describe('Recuperar contraseña (P-23)', () => {
  test('se llega desde el login y el formulario pide sólo el correo', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /olvidaste tu contraseña/i }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.locator('#forgot-email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar enlace' })).toBeEnabled();
  });

  test('con la cuenta existente muestra el mensaje genérico y ningún enlace', async ({ page }) => {
    await mockForgot(page, {
      message: 'If an account exists with this email, a password reset link will be sent.',
    });

    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill('test-admin@test.local');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();

    // El texto es el localizado, no el mensaje crudo de la API (que está en inglés).
    await expect(page.getByText(/Si test-admin@test\.local está registrado/)).toBeVisible();
    await expect(page.getByTestId('forgot-password-dev-link')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /volver al inicio/i })).toBeVisible();
  });

  test('sin correo configurado ofrece el enlace de desarrollo', async ({ page }) => {
    await mockForgot(page, {
      message: 'If an account exists with this email, a password reset link will be sent.',
      mockUrl: 'http://localhost:3000/reset-password?token=abc123',
    });

    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill('test-admin@test.local');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();

    const devLink = page.getByTestId('forgot-password-dev-link');
    await expect(devLink).toBeVisible();
    await expect(devLink.getByRole('link')).toHaveAttribute(
      'href',
      'http://localhost:3000/reset-password?token=abc123'
    );
  });

  test('el límite de intentos se explica en la pantalla', async ({ page }) => {
    await mockForgot(
      page,
      { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
      429
    );

    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill('test-admin@test.local');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();

    await expect(page.getByRole('alert').filter({ hasText: /demasiados intentos/i })).toBeVisible();
  });
});
