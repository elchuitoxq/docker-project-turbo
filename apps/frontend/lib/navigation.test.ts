import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from './navigation';
import { PERMISSIONS } from './permissions';

describe('NAV_ITEMS', () => {
  it('contains the six main module groups', () => {
    const titles = NAV_ITEMS.map((g) => g.title);
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
