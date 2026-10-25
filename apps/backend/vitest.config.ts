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
    env: {
      TEST_DATABASE_URL: backendTestUrl,
      DATABASE_URL: backendTestUrl,
    },
  },
});
