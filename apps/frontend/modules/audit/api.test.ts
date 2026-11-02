import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: Array<{ method: string; path: string }> = [];

vi.mock('@/lib/api/client', () => {
  const record =
    (method: string) =>
    (path: string): Promise<unknown> => {
      calls.push({ method, path });
      return Promise.resolve({});
    };

  return {
    apiClient: {
      get: record('GET'),
      getText: record('GETTEXT'),
      post: record('POST'),
      patch: record('PATCH'),
      put: record('PUT'),
      delete: record('DELETE'),
    },
  };
});

const { auditApi, diffRows } = await import('./api');

beforeEach(() => {
  calls.length = 0;
});

describe('auditApi', () => {
  it('pide la página con paginado y límite', async () => {
    await auditApi.list({}, 2, 25);

    expect(calls[0].path).toBe('/audit?paginated=true&page=2&limit=25');
  });

  it('agrega los filtros activos y omite los vacíos', async () => {
    await auditApi.list({ entityTable: 'invoices', documentCode: 'A-90006', action: '' }, 1, 50);

    expect(calls[0].path).toContain('entityTable=invoices');
    expect(calls[0].path).toContain('documentCode=A-90006');
    expect(calls[0].path).not.toContain('action=');
  });

  it('consulta las tablas auditadas', async () => {
    await auditApi.entityTables();

    expect(calls[0]).toEqual({ method: 'GET', path: '/audit/entities' });
  });

  it('manda la búsqueda libre y los filtros nuevos', async () => {
    await auditApi.list({ q: 'A-90006', module: 'billing', result: 'DENIED' }, 1, 25);

    expect(calls[0].path).toContain('q=A-90006');
    expect(calls[0].path).toContain('module=billing');
    expect(calls[0].path).toContain('result=DENIED');
  });

  it('consulta las facetas del registro', async () => {
    await auditApi.facets();

    expect(calls[0]).toEqual({ method: 'GET', path: '/audit/facets' });
  });

  it('exporta con los filtros activos y sin paginado', async () => {
    await auditApi.exportCsv({ module: 'treasury', q: 'PAY-1' });

    expect(calls[0].method).toBe('GETTEXT');
    expect(calls[0].path).toBe('/audit/export?module=treasury&q=PAY-1');
  });
});

describe('diffRows', () => {
  it('convierte el par before/after en filas legibles', () => {
    const rows = diffRows({
      before: { total: 100, status: 'DRAFT' },
      after: { total: 120, status: 'POSTED' },
    });

    expect(rows).toEqual([
      { field: 'total', before: '100', after: '120' },
      { field: 'estado', before: 'DRAFT', after: 'POSTED' },
    ]);
  });

  it('ignora campos que no cambiaron', () => {
    const rows = diffRows({ before: { total: 100, name: 'A' }, after: { total: 100, name: 'A' } });

    expect(rows).toHaveLength(0);
  });

  it('tolera un alta sin valores previos', () => {
    const rows = diffRows({ after: { total: 500, isActive: true } });

    expect(rows).toEqual([
      { field: 'total', before: '—', after: '500' },
      { field: 'activo', before: '—', after: 'sí' },
    ]);
  });

  it('traduce los campos en snake_case de la fila cruda', () => {
    const rows = diffRows({ before: { tax_id: 'J-1' }, after: { tax_id: 'J-2' } });

    expect(rows).toEqual([{ field: 'RIF', before: 'J-1', after: 'J-2' }]);
  });

  it('devuelve vacío si no hay cambios o no son un objeto', () => {
    expect(diffRows(null)).toEqual([]);
    expect(diffRows([])).toEqual([]);
    expect(diffRows('texto' as never)).toEqual([]);
  });
});
