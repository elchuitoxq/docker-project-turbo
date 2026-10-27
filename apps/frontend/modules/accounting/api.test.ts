import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contrato de `modules/accounting/api.ts`. Fija ruta y cuerpo de cada método para que el cliente no
 * se desalinee del backend (pasó ya con nómina: la UI consumía campos inexistentes).
 */

const calls: Array<{ method: string; path: string; body?: unknown }> = [];

vi.mock('@/lib/api/client', () => {
  const record =
    (method: string) =>
    (path: string, body?: unknown): Promise<unknown> => {
      calls.push({ method, path, body });
      return Promise.resolve({});
    };

  return {
    apiClient: {
      get: record('GET'),
      post: record('POST'),
      patch: record('PATCH'),
      put: record('PUT'),
      delete: record('DELETE'),
    },
  };
});

const { accountingApi } = await import('./api');

beforeEach(() => {
  calls.length = 0;
});

describe('accountingApi · plan de cuentas', () => {
  it('lista el árbol y crea con jerarquía', async () => {
    await accountingApi.listAccounts();
    await accountingApi.createAccount({
      code: '1.1.1.004',
      name: 'Caja chica',
      type: 'ASSET',
      parentId: 'a-1',
      branchId: 'b-1',
    });

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /accounting/accounts',
      'POST /accounting/accounts',
    ]);
    expect(calls[1].body).toMatchObject({ code: '1.1.1.004', parentId: 'a-1' });
  });

  it('actualiza y desactiva sobre el id de la cuenta', async () => {
    await accountingApi.updateAccount('a-1', { isPostable: false });
    await accountingApi.deleteAccount('a-1');

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'PATCH /accounting/accounts/a-1',
      'DELETE /accounting/accounts/a-1',
    ]);
  });
});

describe('accountingApi · asientos', () => {
  it('serializa los filtros del libro', async () => {
    await accountingApi.listEntries();
    await accountingApi.listEntries({
      from: '2026-10-01',
      to: '2026-10-31',
      sourceType: 'PAYROLL',
    });

    expect(calls[0].path).toBe('/accounting/entries');
    expect(calls[1].path).toBe(
      '/accounting/entries?from=2026-10-01&to=2026-10-31&sourceType=PAYROLL'
    );
  });

  it('crea, edita y postea', async () => {
    await accountingApi.createEntry({
      date: '2026-10-27T00:00:00.000Z',
      description: 'Provisión',
      status: 'DRAFT',
      lines: [
        { accountId: 'a-1', debit: 100, credit: 0 },
        { accountId: 'a-2', debit: 0, credit: 100 },
      ],
    });
    await accountingApi.updateEntry('e-1', { description: 'Provisión corregida' });
    await accountingApi.postEntry('e-1');
    await accountingApi.getEntry('e-1');

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'POST /accounting/entries',
      'PATCH /accounting/entries/e-1',
      'POST /accounting/entries/e-1/post',
      'GET /accounting/entries/e-1',
    ]);
  });
});

describe('accountingApi · cierre y reportes', () => {
  it('lista períodos por año y cierra/reabre', async () => {
    await accountingApi.listPeriods(2026);
    await accountingApi.closePeriod('p-10');
    await accountingApi.reopenPeriod('p-10', 'Ajuste');

    expect(calls[0].path).toBe('/accounting/periods?year=2026');
    expect(calls[1].path).toBe('/accounting/periods/p-10/close');
    expect(calls[2].body).toEqual({ reason: 'Ajuste' });
  });

  it('consulta los tres estados con sus parámetros', async () => {
    await accountingApi.trialBalance('2026-10-01', '2026-10-31');
    await accountingApi.balanceSheet('2026-10-31');
    await accountingApi.incomeStatement();

    expect(calls[0].path).toBe('/reports/trial-balance?from=2026-10-01&to=2026-10-31');
    expect(calls[1].path).toBe('/reports/balance-sheet?date=2026-10-31');
    expect(calls[2].path).toBe('/reports/income-statement');
  });
});
