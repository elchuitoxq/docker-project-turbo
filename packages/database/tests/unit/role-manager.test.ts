import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '../../src/scripts/seed-rbac';

/**
 * Contrato del cargo MANAGER (`S-14`).
 *
 * El rol está definido por lo que un gerente de sucursal **hace** en el ERP, no por una lista de
 * códigos: si alguien quita un permiso de esta lista, el flujo documentado en `docs/qa/01-manager.md`
 * deja de ser ejecutable. Y si alguien agrega un permiso de la lista prohibida, el gerente pasa a
 * poder administrar el sistema o a contabilizar, que es exactamente lo que el cargo no hace.
 */

/** Actuaciones documentadas del gerente (S-14 §2). */
const CARGO = {
  'supervisar la operación': [
    'dashboard:view',
    'settings:companies:view',
    'settings:branches:view',
    'finance:reports:view',
  ],
  'gestionar terceros y su saldo': [
    'operations:partners:view',
    'operations:partners:create',
    'operations:partners:edit',
    'operations:partners:statement',
  ],
  'vender y facturar': [
    'operations:sales:view',
    'operations:sales:create',
    'finance:invoices:view',
    'finance:invoices:create',
    'finance:invoices:edit',
    'finance:invoices:post',
  ],
  'gestionar pedidos de venta': [
    'operations:orders:view',
    'operations:orders:create',
    'operations:orders:edit',
    'operations:orders:approve',
  ],
  'comprar y pagar': [
    'operations:purchases:view',
    'finance:payments:view',
    'finance:payments:create',
    'finance:payments:void',
  ],
  'administrar el catálogo y el stock': [
    'inventory:products:view',
    'inventory:products:create',
    'inventory:products:edit',
    'inventory:moves:view',
    'inventory:moves:approve',
  ],
  'operar la tesorería': [
    'finance:treasury:view',
    'finance:treasury:create_account',
    'finance:treasury:reconcile',
    'finance:treasury:petty-cash',
    'finance:treasury:daily-close',
  ],
  'ajustar cartera': [
    'finance:credit-notes:view',
    'finance:credit-notes:manage',
    'finance:loans:view',
    'finance:loans:manage',
  ],
  'leer contabilidad y personal': [
    'finance:accounts:view',
    'finance:entries:view',
    'finance:close:view',
    'hr:view',
    'hr:employees:view',
  ],
} as const;

/** Lo que el gerente **no** hace: administración del sistema, fiscalidad y nómina. */
const PROHIBIDOS = [
  'settings:users:view',
  'settings:users:create',
  'settings:users:edit',
  'settings:users:manage',
  'settings:roles:view',
  'settings:roles:manage',
  'settings:currencies:manage',
  'settings:banks:manage',
  'settings:branches:manage',
  'settings:companies:manage',
  'settings:taxes:manage',
  'finance:invoices:void',
  'finance:retentions:view',
  'finance:entries:create',
  'finance:entries:post',
  'finance:accounts:manage',
  'finance:close:manage',
  'hr:payroll:view',
  'hr:payroll:process',
  'hr:incidents:view',
  'hr:incidents:approve',
  'hr:concepts:view',
  'hr:settings:view',
  'core:branch:all',
] as const;

const manager = new Set(ROLE_PERMISSIONS.MANAGER);

describe('ROLE_PERMISSIONS.MANAGER', () => {
  it.each(Object.entries(CARGO))('puede %s', (_actuacion, permisos) => {
    expect([...permisos].filter(code => !manager.has(code))).toEqual([]);
  });

  it('no recibe permisos fuera de su cargo', () => {
    expect(PROHIBIDOS.filter(code => manager.has(code))).toEqual([]);
  });

  it('sólo usa códigos del catálogo', () => {
    const catalog = new Set(ALL_PERMISSIONS);
    expect([...manager].filter(code => !catalog.has(code))).toEqual([]);
  });

  it('no administra el sistema pero sí opera: entre 40 y 55 permisos', () => {
    expect(manager.size).toBeGreaterThanOrEqual(40);
    expect(manager.size).toBeLessThanOrEqual(55);
  });
});
