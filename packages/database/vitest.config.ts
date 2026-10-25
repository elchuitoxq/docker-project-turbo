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
  },
});
