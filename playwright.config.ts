import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // La API limita a 100 peticiones por minuto y por IP: con más de 2 navegadores en paralelo la
  // propia suite agota el límite y falla por 429, no por un defecto del producto.
  workers: isCI ? 1 : 2,
  timeout: 30_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'pnpm --filter frontend dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
