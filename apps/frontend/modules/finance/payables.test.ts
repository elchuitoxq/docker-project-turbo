import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contrato de `modules/finance/api/payables.ts` con el backend.
 *
 * Fija la ruta y el query string de cada método: los endpoints de cuentas por pagar cuelgan de
 * `/billing/invoices/payables` (no de `/billing/payables`) y se declaran antes de `:id`, así que un
 * cambio de ruta aquí rompería la pantalla sin que el typecheck lo note.
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

const { payablesApi } = await import('./api/payables');

beforeEach(() => {
  calls.length = 0;
});

describe('payablesApi', () => {
  it('lista sin filtros', async () => {
    await payablesApi.list();

    expect(calls[0]).toEqual({
      method: 'GET',
      path: '/billing/invoices/payables',
      body: undefined,
    });
  });

  it('lista con estado y fecha de corte', async () => {
    await payablesApi.list({ status: 'OVERDUE', asOf: '2026-11-30' });

    expect(calls[0].path).toBe('/billing/invoices/payables?status=OVERDUE&asOf=2026-11-30');
  });

  it('omite los filtros vacíos', async () => {
    await payablesApi.list({ partnerId: '', status: undefined });

    expect(calls[0].path).toBe('/billing/invoices/payables');
  });

  it('pide el aging con la fecha de corte', async () => {
    await payablesApi.aging('2026-12-31');

    expect(calls[0].path).toBe('/billing/invoices/payables/aging?asOf=2026-12-31');
  });

  it('lee y actualiza los parámetros de retención', async () => {
    await payablesApi.getRetentionSettings();
    await payablesApi.updateRetentionSettings({ islrRate: 5 });

    expect(calls[0]).toEqual({
      method: 'GET',
      path: '/billing/invoices/supplier-retention-settings',
      body: undefined,
    });
    expect(calls[1]).toEqual({
      method: 'PATCH',
      path: '/billing/invoices/supplier-retention-settings',
      body: { islrRate: 5 },
    });
  });
});
