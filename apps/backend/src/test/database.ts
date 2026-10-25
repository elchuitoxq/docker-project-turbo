import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

function getTestDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error('TEST_DATABASE_URL must point to the isolated testdb_backend database');
  }

  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    database !== 'testdb_backend' ||
    !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error('Backend tests may only connect to the local testdb_backend database');
  }

  return value;
}

const testQueryClient = postgres(getTestDatabaseUrl(), {
  max: 1,
  connect_timeout: 5,
});

export const testDb: PostgresJsDatabase<typeof schema> = drizzle(testQueryClient, { schema });

export async function cleanDatabase() {
  const tables = await testQueryClient<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'
  `;
  if (tables.length === 0) return;

  const tableNames = tables.map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`).join(', ');
  await testQueryClient.unsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
}

export async function closeTestConnection() {
  await testQueryClient.end();
}
