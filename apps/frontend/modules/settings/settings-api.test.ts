import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contrato de los clientes de maestros (`banks` y `tax-concepts`).
 *
 * Las dos pantallas existían como stub: fijar ruta y cuerpo de cada método evita que la UI vuelva a
 * quedarse sin backend o apuntando a una ruta inexistente.
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

const { banksApi } = await import('@/modules/settings/banks/api');
const { taxConceptsApi } = await import('@/modules/settings/tax-concepts/api');

beforeEach(() => {
  calls.length = 0;
});

describe('banksApi', () => {
  it('lista, crea, actualiza y alterna el estado del banco', async () => {
    await banksApi.list();
    await banksApi.create({ name: 'Banco de Venezuela', code: '0102' });
    await banksApi.update('b-1', { name: 'BDV' });
    await banksApi.toggle('b-1');

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /settings/banks',
      'POST /settings/banks',
      'PATCH /settings/banks/b-1',
      'POST /settings/banks/b-1/toggle',
    ]);
    expect(calls[1].body).toMatchObject({ name: 'Banco de Venezuela', code: '0102' });
    expect(calls[2].body).toMatchObject({ name: 'BDV' });
  });
});

describe('taxConceptsApi', () => {
  it('lista, crea, actualiza y elimina el concepto', async () => {
    await taxConceptsApi.list();
    await taxConceptsApi.create({
      code: 'ISLR-001',
      name: 'Honorarios profesionales',
      retentionPercentage: 3,
      baseMin: 0,
    });
    await taxConceptsApi.update('t-1', { isEnabled: false });
    await taxConceptsApi.remove('t-1');

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /settings/tax-concepts',
      'POST /settings/tax-concepts',
      'PATCH /settings/tax-concepts/t-1',
      'DELETE /settings/tax-concepts/t-1',
    ]);
    expect(calls[1].body).toMatchObject({ retentionPercentage: 3 });
  });
});
