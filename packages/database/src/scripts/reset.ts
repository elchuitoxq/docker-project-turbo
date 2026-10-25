import { db } from '../index';
import { seedRbac } from './seed-rbac';

async function resetDatabase() {
  console.log('Resetting database...');
  console.log('⚠️  This will drop all tables!');

  await db.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log('All tables dropped.');

  await seedRbac();
  console.log('RBAC seeded.');
}

resetDatabase()
  .then(() => {
    console.log('Reset completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
