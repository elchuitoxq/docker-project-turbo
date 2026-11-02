import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERMISSIONS } from './permissions';

/** Busca el catálogo del backend desde el cwd para no depender del layout del transform. */
function seedRbacPath(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, 'packages/database/src/scripts/seed-rbac.ts');
    if (existsSync(candidate)) return candidate;
    dir = resolve(dir, '..');
  }
  throw new Error('No se encontró packages/database/src/scripts/seed-rbac.ts');
}

describe('PERMISSIONS', () => {
  it('exposes canonical module permissions', () => {
    expect(PERMISSIONS.DASHBOARD.VIEW).toBe('dashboard:view');
    expect(PERMISSIONS.OPERATIONS.PARTNERS.VIEW).toBe('operations:partners:view');
    expect(PERMISSIONS.FINANCE.INVOICES.POST).toBe('finance:invoices:post');
    expect(PERMISSIONS.HR.PAYROLL.PROCESS).toBe('hr:payroll:process');
    expect(PERMISSIONS.SETTINGS.USERS.MANAGE).toBe('settings:users:manage');
  });

  it('uses module:[submodule:]action format', () => {
    const all = [
      PERMISSIONS.DASHBOARD.VIEW,
      PERMISSIONS.OPERATIONS.PARTNERS.CREATE,
      PERMISSIONS.INVENTORY.MOVES.APPROVE,
      PERMISSIONS.FINANCE.PAYMENTS.VOID,
    ];
    for (const code of all) {
      expect(code).toMatch(/^[a-z]+(:[a-z_]+){1,2}$/);
    }
  });

  it('mantiene los códigos sincronizados con el catálogo del backend (seed-rbac)', () => {
    const source = readFileSync(seedRbacPath(), 'utf8');
    const start = source.indexOf('export const ALL_PERMISSIONS');
    const end = source.indexOf('];', start);
    const catalog = new Set([...source.slice(start, end).matchAll(/'([^']+)'/g)].map(m => m[1]));

    const frontend: string[] = [];
    const collect = (value: unknown) => {
      if (typeof value === 'string') frontend.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(PERMISSIONS);

    expect(catalog.size).toBeGreaterThan(50);
    expect(frontend.filter(code => !catalog.has(code))).toEqual([]);
  });
});
