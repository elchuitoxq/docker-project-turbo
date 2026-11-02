import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/lib/permissions';
import {
  ALL_PERMISSION_CODES,
  canOpenSubmodule,
  flattenPermissions,
  matchesQuery,
  modulePermissions,
  moduleSummary,
  permissionMatrix,
  rolePermissions,
  searchGuides,
  submoduleAccess,
  toPermissionSet,
} from './access';
import { parseProgress, serializeProgress, toggleReviewed } from './progress';
import { GUIDE_MODULES, findGuideModule } from './registry';
import { GUIDE_ROLES } from './roles';
import type { GuideSubmodule } from './types';

const submodule: GuideSubmodule = {
  id: 'demo',
  title: 'Demo',
  href: '/demo',
  summary: 'Pantalla de prueba',
  viewPermission: 'demo:view',
  actions: [
    { label: 'Ver', permission: 'demo:view' },
    { label: 'Crear', permission: 'demo:create' },
  ],
  steps: ['Paso'],
  rules: ['Regla'],
  pitfalls: [],
};

describe('flattenPermissions', () => {
  it('aplana el árbol completo sin duplicados', () => {
    const codes = flattenPermissions();
    expect(codes).toContain(PERMISSIONS.FINANCE.INVOICES.POST);
    expect(codes).toContain(PERMISSIONS.CORE.BRANCH_ALL);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual([...ALL_PERMISSION_CODES]);
  });
});

describe('catálogo de la guía', () => {
  it('sólo referencia permisos que existen en el sistema', () => {
    const known = new Set(ALL_PERMISSION_CODES);
    const referenced = GUIDE_MODULES.flatMap(module => modulePermissions(module));
    const unknown = referenced.filter(code => !known.has(code));
    expect(unknown).toEqual([]);
  });

  it('los roles del simulador usan permisos reales', () => {
    const known = new Set(ALL_PERMISSION_CODES);
    const unknown = GUIDE_ROLES.flatMap(role => rolePermissions(role)).filter(
      code => !known.has(code)
    );
    expect(unknown).toEqual([]);
  });

  it('cubre las cinco rutas del dashboard', () => {
    expect(GUIDE_MODULES.map(module => module.id)).toEqual([
      'inventory',
      'operations',
      'finance',
      'hr',
      'settings',
    ]);
    expect(findGuideModule('finance')?.submodules.length).toBeGreaterThan(10);
  });

  it('no repite identificadores de submódulos dentro de un módulo', () => {
    for (const guide of GUIDE_MODULES) {
      const ids = guide.submodules.map(submodule => submodule.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('submoduleAccess', () => {
  it('devuelve none sin el permiso de entrada', () => {
    expect(submoduleAccess(new Set(['demo:create']), submodule)).toBe('none');
  });

  it('devuelve partial cuando falta una acción', () => {
    expect(submoduleAccess(new Set(['demo:view']), submodule)).toBe('partial');
  });

  it('devuelve full con la pantalla y todas las acciones', () => {
    expect(submoduleAccess(new Set(['demo:view', 'demo:create']), submodule)).toBe('full');
  });

  it('acepta cualquiera de los permisos alternativos de entrada', () => {
    const branches = findGuideModule('settings')?.submodules.find(item => item.id === 'branches');
    expect(branches).toBeDefined();
    if (!branches) return;
    expect(canOpenSubmodule(new Set([PERMISSIONS.SETTINGS.COMPANIES.VIEW]), branches)).toBe(true);
    expect(canOpenSubmodule(new Set([PERMISSIONS.SETTINGS.BRANCHES.VIEW]), branches)).toBe(true);
    expect(canOpenSubmodule(new Set(['settings:view']), branches)).toBe(false);
  });
});

describe('moduleSummary', () => {
  it('cuenta completos, parciales y sin acceso', () => {
    const inventory = findGuideModule('inventory');
    expect(inventory).toBeDefined();
    if (!inventory) return;

    const seller = toPermissionSet([
      ...(GUIDE_ROLES.find(role => role.id === 'SELLER')?.permissions ?? []),
    ]);
    const sellerSummary = moduleSummary(seller, inventory);
    expect(sellerSummary.total).toBe(inventory.submodules.length);
    expect(sellerSummary.full + sellerSummary.partial + sellerSummary.none).toBe(
      sellerSummary.total
    );
    expect(sellerSummary.none).toBeGreaterThan(0);
    expect(sellerSummary.coverage).toBeLessThan(100);

    const admin = moduleSummary(toPermissionSet(rolePermissions(GUIDE_ROLES[0])), inventory);
    expect(admin.full).toBe(admin.total);
    expect(admin.coverage).toBe(100);
  });
});

describe('permissionMatrix', () => {
  it('devuelve una fila por rol con una celda por submódulo', () => {
    const finance = findGuideModule('finance');
    expect(finance).toBeDefined();
    if (!finance) return;

    const matrix = permissionMatrix(finance, GUIDE_ROLES);
    expect(matrix).toHaveLength(GUIDE_ROLES.length);
    for (const row of matrix) {
      expect(row.cells).toHaveLength(finance.submodules.length);
    }

    const sellerRow = matrix.find(row => row.role.id === 'SELLER');
    const accountantRow = matrix.find(row => row.role.id === 'ACCOUNTANT');
    const invoicesCell = finance.submodules.findIndex(item => item.id === 'invoices');
    expect(sellerRow?.cells[invoicesCell].level).toBe('partial');
    expect(accountantRow?.cells[invoicesCell].level).toBe('partial');
  });
});

describe('búsqueda', () => {
  it('encuentra procesos por código de permiso', () => {
    const results = searchGuides(
      GUIDE_MODULES,
      toPermissionSet(ALL_PERMISSION_CODES),
      PERMISSIONS.FINANCE.INVOICES.POST
    );
    expect(results.some(result => result.submoduleId === 'invoices')).toBe(true);
  });

  it('sin término no devuelve resultados', () => {
    expect(searchGuides(GUIDE_MODULES, toPermissionSet([]), '   ')).toEqual([]);
  });

  it('matchesQuery filtra por reglas y pasos', () => {
    expect(matchesQuery(submodule, 'regla')).toBe(true);
    expect(matchesQuery(submodule, 'inexistente')).toBe(false);
  });
});

describe('progreso de lectura', () => {
  it('tolera datos corruptos', () => {
    expect(parseProgress(null)).toEqual([]);
    expect(parseProgress('no-json')).toEqual([]);
    expect(parseProgress('{"a":1}')).toEqual([]);
    expect(parseProgress('["a",2,"b"]')).toEqual(['a', 'b']);
  });

  it('serializa sin duplicados y alterna el estado', () => {
    expect(serializeProgress(['a', 'a', 'b'])).toBe('["a","b"]');
    expect(toggleReviewed(['a'], 'a')).toEqual([]);
    expect(toggleReviewed(['a'], 'b')).toEqual(['a', 'b']);
  });
});
