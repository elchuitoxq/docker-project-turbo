import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermission } from './use-permission';
import { useAuthStore } from '@/stores/use-auth-store';
import { routeRequirement } from '@/lib/navigation';
import { ROLE_PERMISSIONS } from '../../../packages/database/src/scripts/seed-rbac';

type RoleName = keyof typeof ROLE_PERMISSIONS;

const roles = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'SELLER',
  'WAREHOUSE',
  'ACCOUNTANT',
] as const satisfies readonly RoleName[];

function isAllowed(allowed: readonly RoleName[], role: RoleName): boolean {
  return allowed.includes(role);
}

const roleWorkflows = [
  {
    name: 'crear pedidos',
    required: ['operations:orders:create'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'],
  },
  {
    name: 'aprobar pedidos',
    required: ['operations:orders:approve'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    name: 'emitir facturas de venta',
    required: ['operations:sales:create', 'finance:invoices:create'],
    // MANAGER emite la factura de la venta que supervisa (S-09, decisión D-03).
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'],
  },
  {
    name: 'ver facturas de compra',
    required: ['operations:purchases:view'],
    // CxP necesita el origen de la deuda (S-09, decisión D-04).
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'anular pagos de tesorería',
    required: ['finance:payments:void'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'ver estado de cuenta de terceros',
    required: ['operations:partners:statement'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    name: 'ver monedas y tasas',
    required: ['settings:currencies:view'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'ver reportes de gestión',
    required: ['finance:reports:view'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'crear clientes y proveedores',
    required: ['operations:partners:create'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    name: 'registrar movimientos de almacén',
    required: ['inventory:moves:create'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE'],
  },
  {
    name: 'aprobar movimientos de almacén',
    required: ['inventory:moves:approve'],
    // El gerente aprueba el ajuste que registra el almacén (S-14, D-09).
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'WAREHOUSE'],
  },
  {
    name: 'corregir borradores de factura',
    required: ['finance:invoices:edit'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    name: 'conciliar extractos bancarios',
    required: ['finance:treasury:reconcile'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'operar la caja chica',
    required: ['finance:treasury:petty-cash'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'cerrar el día de caja',
    required: ['finance:treasury:daily-close'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'procesar nómina',
    required: ['hr:payroll:process'],
    allowed: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'crear pagos',
    required: ['finance:payments:create'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'crear y contabilizar asientos',
    required: ['finance:entries:create', 'finance:entries:post'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  },
  {
    name: 'gestionar cierres contables',
    required: ['finance:close:manage'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  },
  {
    name: 'administrar usuarios',
    required: ['settings:users:manage'],
    allowed: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'operar en modo consolidado entre sucursales',
    required: ['core:branch:all'],
    allowed: ['SUPER_ADMIN'],
  },
] as const satisfies readonly {
  name: string;
  required: readonly string[];
  allowed: readonly RoleName[];
}[];

const roleRoutes = [
  {
    name: 'pedidos',
    path: '/dashboard/operations/orders',
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'],
  },
  {
    name: 'movimientos de almacén',
    path: '/dashboard/inventory/moves',
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'WAREHOUSE'],
  },
  {
    name: 'facturación',
    path: '/dashboard/finance/invoices',
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER', 'ACCOUNTANT'],
  },
  {
    name: 'contabilidad',
    path: '/dashboard/finance/accounting',
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'nómina',
    path: '/dashboard/hr/payroll',
    allowed: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'administración de usuarios',
    path: '/dashboard/settings/users',
    allowed: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'compras',
    path: '/dashboard/operations/purchases',
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'monedas y tasas',
    path: '/dashboard/settings/currencies',
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'reportes',
    path: '/dashboard/finance/reports',
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
] as const satisfies readonly { name: string; path: string; allowed: readonly RoleName[] }[];

vi.mock('../../../packages/database/src/index', () => ({ db: {} }));

function setRole(role: RoleName) {
  useAuthStore.setState({
    user: {
      id: `test-${role}`,
      name: role,
      email: `${role.toLowerCase()}@test.local`,
      permissions: ROLE_PERMISSIONS[role],
      branches: [],
    },
    isAuthenticated: true,
    hasHydrated: true,
  });
}

describe('usePermission', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: null,
      user: {
        id: 'u-1',
        name: 'Test',
        email: 't@t.c',
        permissions: ['dashboard:view', 'finance:invoices:view'],
        branches: [],
      },
      isAuthenticated: true,
      hasHydrated: true,
    });
  });

  it('hasPermission() returns true for granted permission', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasPermission('dashboard:view')).toBe(true);
  });

  it('hasPermission() returns false for missing permission', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasPermission('hr:payroll:process')).toBe(false);
  });

  it('hasPermission() returns true for null/undefined (no requirement)', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasPermission(null)).toBe(true);
    expect(result.current.hasPermission(undefined)).toBe(true);
  });

  it('hasAnyPermission() returns true if any matches', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasAnyPermission(['none:here', 'dashboard:view'])).toBe(true);
  });

  it('hasAnyPermission() returns false if none match', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasAnyPermission(['a:b', 'c:d'])).toBe(false);
  });

  it('hasAllPermissions() returns true only when all match', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasAllPermissions(['dashboard:view', 'finance:invoices:view'])).toBe(
      true
    );
    expect(result.current.hasAllPermissions(['dashboard:view', 'hr:payroll:process'])).toBe(false);
  });

  it('hasAnyPermission() with empty list returns true', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasAnyPermission([])).toBe(true);
  });

  describe.each(roleWorkflows)('$name', workflow => {
    it.each(roles)('matches the assigned permissions for %s', role => {
      setRole(role);
      const { result } = renderHook(() => usePermission());

      expect(result.current.hasAllPermissions([...workflow.required])).toBe(
        isAllowed(workflow.allowed, role)
      );
    });
  });

  describe.each(roleRoutes)('route: $name', route => {
    it.each(roles)('allows only assigned roles to open it (%s)', role => {
      setRole(role);
      const { result } = renderHook(() => usePermission());
      const requirement = routeRequirement(route.path);

      expect(requirement).not.toBeNull();
      if (!requirement) throw new Error(`No route requirement found for ${route.path}`);

      const allowed =
        result.current.hasAllPermissions(requirement.all) &&
        result.current.hasAnyPermission(requirement.any);
      expect(allowed).toBe(isAllowed(route.allowed, role));
    });
  });
});
