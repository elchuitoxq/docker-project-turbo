import { defineConfig } from 'vitest/config';

const backendTestUrl =
  process.env.BACKEND_TEST_DATABASE_URL ??
  'postgres://testuser:testpassword@localhost:5433/testdb_backend';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/test/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // Los tests tocan Postgres; en CI con runners lentos 10 s (default) no alcanza.
    // 60 s cubre el caso peor: el suite completo en paralelo con el resto del pipeline.
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      TEST_DATABASE_URL: backendTestUrl,
      DATABASE_URL: backendTestUrl,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Umbrales de no-regresión (medidos 2026-10-26: 70.21 / 56.88 / 74.32 / 71.01).
      thresholds: { statements: 65, branches: 50, functions: 68, lines: 66 },
    },
  },
});
