import { db } from '../index';

/**
 * Borra el esquema de la base (`S-16`).
 *
 * También elimina el esquema `drizzle`, que es donde `drizzle-kit` lleva el registro de migraciones
 * aplicadas. Sin eso, `db:migrate` cree que ya está todo aplicado y deja la base vacía sin avisar
 * (era el motivo por el que `db:reset` dejaba el entorno inservible).
 */
async function resetDatabase() {
  console.log('Resetting database...');
  console.log('⚠️  This will drop all tables!');

  await db.execute('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await db.execute('DROP SCHEMA IF EXISTS drizzle CASCADE;');
  console.log('Esquema public y registro de migraciones eliminados.');

  console.log('Siguiente paso obligatorio:');
  console.log('  pnpm --filter database db:migrate');
  console.log('  pnpm --filter database db:seed:dev');
}

resetDatabase()
  .then(() => {
    console.log('Reset completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
