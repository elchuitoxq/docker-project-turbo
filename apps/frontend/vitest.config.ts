import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    fileParallelism: false,
    // `isolate: false` compartía el registro de módulos entre archivos y volvía
    // flaky tests con estado global (msw + stores de zustand). Ver P-09.
    isolate: true,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', '.next', '.turbo', 'dist', 'e2e'],
    // jsdom + msw tardan; con el resto del pipeline en paralelo 5 s (default) no alcanza.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Umbrales de no-regresión (medidos 2026-10-26: 52.31 / 53.84 / 49.34 / 55.00).
      thresholds: { statements: 47, branches: 48, functions: 44, lines: 50 },
    },
  },
});
