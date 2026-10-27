import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { loansApi, loanItemTotals, toLoanList } = await import('./api');

beforeEach(() => {
  calls.length = 0;
});

describe('loansApi', () => {
  it('lista sin filtros cuando no hay estado', async () => {
    await loansApi.list();

    expect(calls[0]).toEqual({ method: 'GET', path: '/loans', body: undefined });
  });

  it('agrega el estado solo cuando viene informado', async () => {
    await loansApi.list({ status: 'ACTIVE' });

    expect(calls[0].path).toBe('/loans?status=ACTIVE');
  });

  it('registra la devolucion contra el endpoint pay', async () => {
    await loansApi.registerReturn('loan-1', [{ productId: 'p-1', quantity: 2 }]);

    expect(calls[0].method).toBe('POST');
    expect(calls[0].path).toBe('/loans/loan-1/pay');
    expect(calls[0].body).toEqual({ items: [{ productId: 'p-1', quantity: 2 }] });
  });

  it('aprueba y rechaza con POST sin cuerpo util', async () => {
    await loansApi.approve('loan-1');
    await loansApi.reject('loan-1');

    expect(calls.map(call => call.path)).toEqual(['/loans/loan-1/approve', '/loans/loan-1/reject']);
  });
});

describe('loanItemTotals', () => {
  it('suma entregados y devueltos por separado', () => {
    const totals = loanItemTotals({
      items: [
        {
          id: '1',
          productId: 'p-1',
          quantity: 2,
          serialNumber: null,
          condition: null,
          kind: 'DELIVERED',
        },
        {
          id: '2',
          productId: 'p-1',
          quantity: 1,
          serialNumber: null,
          condition: null,
          kind: 'RETURNED',
        },
        {
          id: '3',
          productId: 'p-2',
          quantity: 3,
          serialNumber: null,
          condition: null,
          kind: 'DELIVERED',
        },
      ],
    } as never);

    expect(totals).toEqual({ delivered: 5, returned: 1 });
  });

  it('devuelve ceros cuando el listado no trae items', () => {
    expect(loanItemTotals({ items: [] } as never)).toEqual({ delivered: 0, returned: 0 });
  });
});

describe('toLoanList', () => {
  it('acepta arreglo plano y paginado', () => {
    const loan = { id: 'loan-1' } as never;

    expect(toLoanList([loan])).toEqual([loan]);
    expect(toLoanList({ data: [loan], total: 1 })).toEqual([loan]);
    expect(toLoanList(undefined)).toEqual([]);
  });
});
