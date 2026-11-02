import { closeDatabase } from '../index';
import { auditIntegrity } from './seed-integrity';

/**
 * Auditoría manual de integridad de la base (`S-16`).
 *
 * Ejecuta la misma lista de reglas que la semilla y que el gate de CI
 * (`packages/database/tests/integration/seed.test.ts`), para que haya una sola definición de
 * "base íntegra". Uso: `pnpm --filter database db:verify`.
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('AUDITORÍA DE INTEGRIDAD DE DATOS');
  console.log('='.repeat(60));

  const report = await auditIntegrity();

  for (const failure of report.failures) {
    console.log(`❌ [${failure.module}] ${failure.name}: ${failure.rows} fila(s)`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('RESUMEN');
  console.log('='.repeat(60));
  console.log(
    `Total: ${report.total} | ✅ Pasadas: ${report.total - report.failures.length} | ❌ Fallidas: ${report.failures.length}`
  );

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main()
  .catch(error => {
    console.error('La auditoría no pudo ejecutarse:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
