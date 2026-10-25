type TestDatabaseTarget = {
  name: 'testdb_backend' | 'testdb_database';
  url: string;
};

export function validateLocalUrl(name: string, value: string, expectedDatabase: string): string {
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  const testPostgresPort = '5433';

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${name} must use a PostgreSQL URL`);
  }
  if (!localHosts.has(url.hostname)) {
    throw new Error(`${name} must point to a local PostgreSQL instance`);
  }
  if (url.port !== testPostgresPort) {
    throw new Error(`${name} must use the isolated test PostgreSQL port ${testPostgresPort}`);
  }
  if (database !== expectedDatabase) {
    throw new Error(`${name} must target the isolated ${expectedDatabase} database`);
  }

  return value;
}

export const testDatabaseAdminUrl = validateLocalUrl(
  'TEST_DATABASE_ADMIN_URL',
  process.env.TEST_DATABASE_ADMIN_URL ?? 'postgres://testuser:testpassword@localhost:5433/postgres',
  'postgres'
);

export const testDatabaseTargets: TestDatabaseTarget[] = [
  {
    name: 'testdb_backend',
    url: validateLocalUrl(
      'BACKEND_TEST_DATABASE_URL',
      process.env.BACKEND_TEST_DATABASE_URL ??
        'postgres://testuser:testpassword@localhost:5433/testdb_backend',
      'testdb_backend'
    ),
  },
  {
    name: 'testdb_database',
    url: validateLocalUrl(
      'DATABASE_TEST_URL',
      process.env.DATABASE_TEST_URL ??
        'postgres://testuser:testpassword@localhost:5433/testdb_database',
      'testdb_database'
    ),
  },
];
