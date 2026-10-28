import { describe, expect, it } from 'vitest';
import { buildCrumbs, DETAIL_LABEL, isIdentifierSegment, labelForSegment } from './breadcrumb';

const PAYROLL_RUN = '24615290-1b16-4e28-831a-b657f33b121d';

describe('isIdentifierSegment', () => {
  it('reconoce UUID, hex largo y números', () => {
    expect(isIdentifierSegment(PAYROLL_RUN)).toBe(true);
    expect(isIdentifierSegment('0123456789abcdef0123')).toBe(true);
    expect(isIdentifierSegment('123')).toBe(true);
  });

  it('no confunde una sección con un identificador', () => {
    expect(isIdentifierSegment('payroll')).toBe(false);
    expect(isIdentifierSegment('credit-notes')).toBe(false);
    expect(isIdentifierSegment('daily-close')).toBe(false);
  });
});

describe('labelForSegment', () => {
  it('traduce las secciones conocidas', () => {
    expect(labelForSegment('payables')).toBe('Cuentas por pagar');
    expect(labelForSegment('credit-notes')).toBe('Notas de crédito');
    expect(labelForSegment('audit')).toBe('Auditoría');
  });

  it('humaniza un slug desconocido en vez de mostrarlo crudo', () => {
    expect(labelForSegment('mi-seccion-nueva')).toBe('mi seccion nueva');
  });
});

describe('buildCrumbs', () => {
  it('arma la ruta completa con hrefs acumulados', () => {
    const crumbs = buildCrumbs('/dashboard/finance/treasury/accounts');

    expect(crumbs.map(crumb => crumb.label)).toEqual([
      'Panel',
      'Finanzas',
      'Tesorería',
      'Cuentas bancarias',
    ]);
    expect(crumbs[3].href).toBe('/dashboard/finance/treasury/accounts');
  });

  it('reemplaza el identificador del detalle por "Detalle"', () => {
    const crumbs = buildCrumbs(`/dashboard/hr/payroll/${PAYROLL_RUN}`);

    expect(crumbs.map(crumb => crumb.label)).toEqual([
      'Panel',
      'Recursos Humanos',
      'Nómina',
      DETAIL_LABEL,
    ]);
    expect(crumbs[3].isIdentifier).toBe(true);
  });

  it('usa el nombre que la página conoce para el identificador', () => {
    const crumbs = buildCrumbs(`/dashboard/hr/payroll/${PAYROLL_RUN}`, {
      [PAYROLL_RUN]: 'NOM-000001',
    });

    expect(crumbs[3].label).toBe('NOM-000001');
  });

  it('cubre el estado de cuenta, que anida dos niveles con identificador', () => {
    const crumbs = buildCrumbs(`/dashboard/operations/partners/${PAYROLL_RUN}/statement`);

    expect(crumbs.map(crumb => crumb.label)).toEqual([
      'Panel',
      'Operaciones',
      'Clientes y Proveedores',
      DETAIL_LABEL,
      'Estado de cuenta',
    ]);
  });
});
