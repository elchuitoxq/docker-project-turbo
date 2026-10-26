import { defineConfig } from 'vitest/config';

const databaseTestUrl =
  process.env.DATABASE_TEST_URL ??
  'postgres://testuser:testpassword@localhost:5433/testdb_database';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    env: {
      TEST_DATABASE_URL: databaseTestUrl,
      DATABASE_URL: databaseTestUrl,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Umbrales de no-regresión (medidos 2026-10-26: 85.14 / 70.96 / 66.48 / 83.55).
      thresholds: { statements: 80, branches: 65, functions: 60, lines: 78 },
    },
  },
});
