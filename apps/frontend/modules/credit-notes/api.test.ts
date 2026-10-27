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

const { creditNotesApi, toCreditNoteList } = await import('./api');

beforeEach(() => {
  calls.length = 0;
});

describe('creditNotesApi', () => {
  it('omite los filtros vacios del listado', async () => {
    await creditNotesApi.list({ partnerId: 'partner-1', status: '' });

    expect(calls[0].path).toBe('/credit-notes?partnerId=partner-1');
  });

  it('emite y anula con POST vacio', async () => {
    await creditNotesApi.post('nc-1');
    await creditNotesApi.void('nc-1');

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'POST /credit-notes/nc-1/post',
      'POST /credit-notes/nc-1/void',
    ]);
  });

  it('aplica el monto a una factura concreta', async () => {
    await creditNotesApi.apply('nc-1', 'inv-1', 100);

    expect(calls[0].path).toBe('/credit-notes/nc-1/apply/inv-1');
    expect(calls[0].body).toEqual({ amount: 100 });
  });
});

describe('toCreditNoteList', () => {
  it('acepta arreglo plano y paginado', () => {
    const note = { id: 'nc-1' } as never;

    expect(toCreditNoteList([note])).toEqual([note]);
    expect(toCreditNoteList({ data: [note], total: 1 })).toEqual([note]);
    expect(toCreditNoteList(undefined)).toEqual([]);
  });
});
