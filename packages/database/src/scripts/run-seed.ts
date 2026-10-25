import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

type SeedMode = 'dev' | 'test' | 'prod' | 'core' | 'faker';

const seedMode = process.argv[2] as SeedMode | undefined;
const supportedModes: SeedMode[] = ['dev', 'test', 'prod', 'core', 'faker'];

function assertDevelopmentDatabase() {
  if (process.env.SEED_ENV !== 'development') {
    throw new Error('Refusing development seed: set SEED_ENV=development explicitly');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the development seed');
  }

  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  const allowedHosts = new Set(['postgres', 'localhost', '127.0.0.1', '[::1]']);

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Development seed requires a PostgreSQL URL');
  }
  if (!allowedHosts.has(url.hostname) || url.port !== '5432' || database !== 'mydb') {
    throw new Error('Development seed only allows local PostgreSQL on port 5432, database mydb');
  }
}

async function runSeed(mode: SeedMode) {
  if (mode === 'test') {
    const { testDatabaseTargets } = await import('./test-database-urls');
    const target = testDatabaseTargets.find(({ name }) => name === 'testdb_database');
    if (!target) {
      throw new Error('Validated testdb_database target is not configured');
    }
    process.env.DATABASE_URL = target.url;
  } else if (mode === 'dev' || mode === 'core' || mode === 'faker') {
    assertDevelopmentDatabase();
  } else if (mode === 'prod') {
    dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), override: true });
  }

  const { closeDatabase } = await import('../index');
  try {
    switch (mode) {
      case 'dev':
      case 'test': {
        const { seedTestData } = await import('./seed-test');
        await seedTestData();
        break;
      }
      case 'prod': {
        const { seedProdData } = await import('./seed-prod');
        await seedProdData();
        break;
      }
      case 'core': {
        const { seedRbac } = await import('./seed-rbac');
        const { seedCoreData } = await import('./seed-core');
        await seedRbac();
        await seedCoreData();
        break;
      }
      case 'faker': {
        const { seedFaker } = await import('./seed-faker');
        await seedFaker();
        break;
      }
    }
    console.log(`${mode} seed completed.`);
  } finally {
    await closeDatabase();
  }
}

if (!seedMode || !supportedModes.includes(seedMode)) {
  console.error(`Specify a seed mode: ${supportedModes.join(', ')}`);
  process.exitCode = 1;
} else {
  runSeed(seedMode).catch((error: unknown) => {
    console.error(`${seedMode} seed failed:`, error);
    process.exitCode = 1;
  });
}
