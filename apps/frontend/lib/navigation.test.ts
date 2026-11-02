import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, routeRequirement } from './navigation';
import { PERMISSIONS } from './permissions';

describe('NAV_ITEMS', () => {
  it('contains the six main module groups', () => {
    const titles = NAV_ITEMS.map(g => g.title);
    expect(titles).toContain('Dashboard');
    expect(titles).toContain('Operaciones');
    expect(titles).toContain('Inventario');
    expect(titles).toContain('Finanzas');
    expect(titles).toContain('Recursos Humanos');
    expect(titles).toContain('Configuración');
  });

  it('every leaf item has a url', () => {
    for (const group of NAV_ITEMS) {
      for (const item of group.items ?? []) {
        expect(item.url).toBeTruthy();
        expect(item.url.startsWith('/dashboard')).toBe(true);
      }
    }
  });

  it('permissions map to PERMISSIONS const', () => {
    expect(NAV_ITEMS[0]?.permission).toBe(PERMISSIONS.DASHBOARD.VIEW);
  });
});

describe('routeRequirement', () => {
  it('exige el permiso de lectura del ítem del menú', () => {
    expect(routeRequirement('/dashboard/settings/users')).toEqual({
      all: [PERMISSIONS.SETTINGS.USERS.VIEW],
      any: [],
    });
  });

  it('combina el permiso del grupo con el del ítem en rutas anidadas', () => {
    expect(routeRequirement('/dashboard/hr/employees/123')).toEqual({
      all: [PERMISSIONS.HR.VIEW, PERMISSIONS.HR.EMPLOYEES.VIEW],
      any: [],
    });
  });

  it('respeta anyPermissions cuando el ítem admite alternativas', () => {
    expect(routeRequirement('/dashboard/settings/branches')).toEqual({
      all: [],
      any: [PERMISSIONS.SETTINGS.COMPANIES.VIEW, PERMISSIONS.SETTINGS.BRANCHES.VIEW],
    });
  });

  it('no confunde rutas que sólo comparten prefijo textual', () => {
    expect(routeRequirement('/dashboard/settings/users-extra')).toEqual({
      all: [PERMISSIONS.DASHBOARD.VIEW],
      any: [],
    });
  });

  it('usa el grupo Dashboard para rutas del panel fuera del catálogo', () => {
    expect(routeRequirement('/dashboard/bi')).toEqual({
      all: [PERMISSIONS.DASHBOARD.VIEW],
      any: [],
    });
  });

  it('devuelve null fuera del área del panel', () => {
    expect(routeRequirement('/login')).toBeNull();
  });
});
