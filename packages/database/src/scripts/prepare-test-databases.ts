import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import { testDatabaseAdminUrl, testDatabaseTargets } from './test-database-urls';

async function createTestDatabases() {
  const client = postgres(testDatabaseAdminUrl, { max: 1, connect_timeout: 5 });

  try {
    const existing = await client<{ datname: string }[]>`SELECT datname FROM pg_database`;
    const existingNames = new Set(existing.map(({ datname }) => datname));

    for (const { name } of testDatabaseTargets) {
      if (!existingNames.has(name)) {
        await client.unsafe(`CREATE DATABASE "${name}"`);
        console.log(`Created isolated test database: ${name}`);
      }
    }
  } finally {
    await client.end();
  }
}

async function migrateTestDatabases() {
  const migrationsFolder = resolve(process.cwd(), 'drizzle');

  for (const { name, url } of testDatabaseTargets) {
    const client = postgres(url, { max: 1, connect_timeout: 5 });

    try {
      await migrate(drizzle(client), { migrationsFolder });
      console.log(`Applied database migrations to ${name}`);
    } finally {
      await client.end();
    }
  }
}

async function main() {
  await createTestDatabases();
  await migrateTestDatabases();
}

main().catch((error: unknown) => {
  console.error('Unable to prepare isolated test databases:', error);
  process.exitCode = 1;
});
