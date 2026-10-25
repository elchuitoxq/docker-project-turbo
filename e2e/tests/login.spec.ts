import { test, expect } from '@playwright/test';

test.describe('Login E2E Tests', () => {
  test('should load login page and show form', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('text=Iniciar sesión')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login with valid credentials test-admin@test.local', async ({ page }) => {
    await page.goto('/login');
    
    await page.locator('#email').fill('test-admin@test.local');
    await page.locator('#password').fill('Test1234!');
    await page.locator('button[type="submit"]').click();
    
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});