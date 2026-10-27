import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contrato de `modules/hr/api.ts` con el backend.
 *
 * Existe porque este archivo ya se desalineó una vez: describía campos y rutas que la API nunca
 * devolvió (`nationalId`, `salary`, `code`, estados `CALCULATED`/`APPROVED`/`VOID`). Nada lo detectó
 * hasta que la UI se conectó. Aquí se fija la ruta y el cuerpo de cada método.
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

const { hrApi } = await import('./api');

beforeEach(() => {
  calls.length = 0;
});

describe('hrApi · empleados', () => {
  it('lista sin filtros ni query string', async () => {
    await hrApi.listEmployees();
    expect(calls[0]).toEqual({ method: 'GET', path: '/hr/employees', body: undefined });
  });

  it('serializa los filtros de búsqueda', async () => {
    await hrApi.listEmployees({ status: 'ACTIVE', search: 'ana', page: 2, limit: 10 });
    expect(calls[0].path).toBe('/hr/employees?status=ACTIVE&search=ana&page=2&limit=10');
  });

  it('usa los campos reales del contrato', async () => {
    await hrApi.createEmployee({ firstName: 'Ana', identityCard: 'V-1', baseSalary: 100 });
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/hr/employees',
      body: { firstName: 'Ana', identityCard: 'V-1', baseSalary: 100 },
    });
  });

  it('cuelga las acciones del empleado de su id', async () => {
    await hrApi.getEmployee('e-1');
    await hrApi.updateEmployee('e-1', { baseSalary: 200 });
    await hrApi.terminateEmployee('e-1', { reason: 'RENUNCIA', date: '2026-10-31' });

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /hr/employees/e-1',
      'PATCH /hr/employees/e-1',
      'POST /hr/employees/e-1/terminate',
    ]);
  });
});

describe('hrApi · estructura', () => {
  it('departamentos y cargos', async () => {
    await hrApi.listDepartments();
    await hrApi.createDepartment({ name: 'Operaciones' });
    await hrApi.updateDepartment('d-1', { name: 'Ops' });
    await hrApi.listPositions({ departmentId: 'd-1', isActive: true });
    await hrApi.createPosition({ name: 'Analista' });
    await hrApi.updatePosition('p-1', { name: 'Analista II' });

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /hr/departments',
      'POST /hr/departments',
      'PATCH /hr/departments/d-1',
      'GET /hr/positions?departmentId=d-1&isActive=true',
      'POST /hr/positions',
      'PATCH /hr/positions/p-1',
    ]);
  });

  it('novedades con aprobación', async () => {
    await hrApi.listIncidents({ employeeId: 'e-1', type: 'VACATION' });
    await hrApi.createIncident({ employeeId: 'e-1' });
    await hrApi.approveIncident('i-1');
    await hrApi.rejectIncident('i-1');

    expect(calls[3]).toEqual({ method: 'POST', path: '/hr/incidents/i-1/reject', body: {} });
  });
});

describe('hrApi · nómina', () => {
  it('genera el run con los cinco campos que exige el backend', async () => {
    await hrApi.generatePayroll({
      branchId: 'b-1',
      frequency: 'MONTHLY',
      currencyId: 'c-1',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });

    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/hr/payroll/generate',
      body: {
        branchId: 'b-1',
        frequency: 'MONTHLY',
        currencyId: 'c-1',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      },
    });
  });

  it('procesa y paga sobre el id del run', async () => {
    await hrApi.approvePayroll('pr-1');
    await hrApi.payPayroll('pr-1', { methodId: 'm-1', reference: 'octubre' });

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'POST /hr/payroll/pr-1/process',
      'POST /hr/payroll/pr-1/pay',
    ]);
    expect(calls[1].body).toEqual({ methodId: 'm-1', reference: 'octubre' });
  });

  it('lee los parámetros congelados del run', async () => {
    await hrApi.getPayrollParameters('pr-1');
    expect(calls[0].path).toBe('/hr/payroll/pr-1/parameters');
  });

  it('el filtro asOf sólo aparece cuando se envía', async () => {
    await hrApi.getPayrollSettings();
    await hrApi.getPayrollSettings('2026-10-27');

    expect(calls[0].path).toBe('/hr/settings');
    expect(calls[1].path).toBe('/hr/settings?asOf=2026-10-27');
  });

  it('actualiza un parámetro por PATCH (crea una vigencia nueva)', async () => {
    await hrApi.updatePayrollSetting({ key: 'SSO_EMP', value: 5, effectiveFrom: '2026-11-01' });
    expect(calls[0]).toEqual({
      method: 'PATCH',
      path: '/hr/settings',
      body: { key: 'SSO_EMP', value: 5, effectiveFrom: '2026-11-01' },
    });
  });
});

describe('hrApi · conceptos', () => {
  it('CRUD completo del catálogo', async () => {
    await hrApi.listConcepts();
    await hrApi.createConcept({ code: 'PRIMA', name: 'Primas' });
    await hrApi.updateConcept('c-1', { name: 'Primas habituales' });
    await hrApi.deleteConcept('c-1');

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /hr/concept-types',
      'POST /hr/concept-types',
      'PATCH /hr/concept-types/c-1',
      'DELETE /hr/concept-types/c-1',
    ]);
  });
});

describe('hrApi · prestaciones y liquidación', () => {
  it('vacaciones con y sin fecha de corte', async () => {
    await hrApi.getVacationSummary('e-1');
    await hrApi.getVacationSummary('e-1', '2026-10-27');
    await hrApi.registerVacation('e-1', { year: 2026, days: 15, startDate: '2026-11-02' });

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /hr/employees/e-1/vacations',
      'GET /hr/employees/e-1/vacations?asOf=2026-10-27',
      'POST /hr/employees/e-1/vacations',
    ]);
  });

  it('deposita la garantía y registra utilidades', async () => {
    await hrApi.depositBenefit('e-1', { year: 2026, quarter: 4 });
    await hrApi.registerProfitSharing('e-1', { year: 2025, monthsWorked: 12 });

    expect(calls.map(call => call.path)).toEqual([
      '/hr/employees/e-1/benefits/deposit',
      '/hr/employees/e-1/profit-sharing',
    ]);
  });

  it('consulta y registra la liquidación', async () => {
    await hrApi.getSettlement('e-1');
    await hrApi.settleEmployee('e-1', { terminationDate: '2026-10-31', cause: 'RENUNCIA' });

    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /hr/employees/e-1/settlement',
      'POST /hr/employees/e-1/settle',
    ]);
  });
});
