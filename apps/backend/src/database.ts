/**
 * Cliente de base de datos único del monorepo (definido en `packages/database`).
 * Evita dos pools distintos entre migraciones, seeds y API.
 */
export { db, closeDatabase } from 'database';
