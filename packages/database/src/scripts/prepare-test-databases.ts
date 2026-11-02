import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import { testDatabaseAdminUrl, testDatabaseTargets } from './test-database-urls';

const migrationsFolder = resolve(process.cwd(), 'drizzle');

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

/**
 * Recrea una base de prueba desde cero.
 *
 * Son bases descartables: cada archivo de prueba trunca lo que necesita. Si una migración no puede
 * validar los datos que quedaron de corridas anteriores (huérfanos creados cuando todavía no había
 * FK), arrastrarlos no aporta nada y deja el entorno inservible.
 */
async function recreateTestDatabase(name: string) {
  const client = postgres(testDatabaseAdminUrl, { max: 1, connect_timeout: 5 });

  try {
    await client.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.unsafe(`CREATE DATABASE "${name}"`);
    console.log(`Recreated isolated test database: ${name}`);
  } finally {
    await client.end();
  }
}

async function migrateOnce(url: string) {
  const client = postgres(url, { max: 1, connect_timeout: 5 });

  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}

async function migrateTestDatabases() {
  for (const { name, url } of testDatabaseTargets) {
    try {
      await migrateOnce(url);
      console.log(`Applied database migrations to ${name}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
      console.warn(`Migrations failed on ${name} (${reason}). Recreating it from scratch…`);
      await recreateTestDatabase(name);
      await migrateOnce(url);
      console.log(`Applied database migrations to ${name}`);
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
