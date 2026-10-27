import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import { testDb } from './database';
import { auditLogs } from '../schema';
import { AuditService } from '../modules/audit/audit.service';

/**
 * Consulta paginada de auditoría (`T-07-01`) contra Postgres real.
 *
 * El visor filtra por tabla, acción, documento y usuario; el `total` debe corresponder al mismo
 * filtro que la página, o el paginador miente.
 */

const audit = new AuditService();

async function seedLogs(prefix: string) {
  const entityId = faker.string.uuid();
  const rows = [
    {
      entityTable: 'invoices',
      entityId,
      action: 'CREATE',
      documentCode: `${prefix}-A-1`,
      changes: { before: null, after: { total: 100 } } as never,
    },
    {
      entityTable: 'invoices',
      entityId,
      action: 'UPDATE',
      documentCode: `${prefix}-A-1`,
      changes: { before: { total: 100 }, after: { total: 120 } } as never,
    },
    {
      entityTable: 'payments',
      entityId: faker.string.uuid(),
      action: 'CREATE',
      documentCode: `${prefix}-PAY-1`,
      changes: null as never,
    },
  ];

  await testDb.insert(auditLogs).values(rows);

  return { entityId };
}

describe('Auditoría paginada (T-07-01)', () => {
  it('pagina y devuelve el total del filtro', async () => {
    const prefix = `T${faker.string.numeric(6)}`;
    await seedLogs(prefix);

    const page = await audit.findPaginated({ documentCode: prefix }, 1, 2);

    expect(page.total).toBe(3);
    expect(page.data).toHaveLength(2);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(2);

    const second = await audit.findPaginated({ documentCode: prefix }, 2, 2);
    expect(second.data).toHaveLength(1);
  });

  it('filtra por acción y por entidad', async () => {
    const prefix = `T${faker.string.numeric(6)}`;
    const { entityId } = await seedLogs(prefix);

    const updates = await audit.findPaginated({ documentCode: prefix, action: 'UPDATE' }, 1, 10);
    expect(updates.total).toBe(1);

    const entity = await audit.findPaginated({ entityId }, 1, 10);
    expect(entity.total).toBe(2);
  });

  it('ordena de más reciente a más antiguo', async () => {
    const prefix = `T${faker.string.numeric(6)}`;
    await seedLogs(prefix);

    const page = await audit.findPaginated({ documentCode: prefix }, 1, 10);
    const dates = page.data.map(row => new Date(row.createdAt ?? 0).getTime());

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('limita el tamaño de página a 200', async () => {
    const page = await audit.findPaginated({}, 1, 5_000);

    expect(page.limit).toBe(200);
  });

  it('expone las tablas auditadas para el filtro', async () => {
    const tables = await audit.listEntityTables();

    expect(tables).toContain('invoices');
    expect(tables).toContain('payments');
    expect(new Set(tables).size).toBe(tables.length);
  });

  it('mantiene el arreglo plano del contrato anterior', async () => {
    const prefix = `T${faker.string.numeric(6)}`;
    await seedLogs(prefix);

    const rows = await audit.findAll({ documentCode: prefix });

    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(3);
  });
});
