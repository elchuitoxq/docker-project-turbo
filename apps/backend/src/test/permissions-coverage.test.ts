import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const modulesRoot = resolve(__dirname, '..', 'modules');
const seedRbac = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'database',
  'src',
  'scripts',
  'seed-rbac.ts'
);

/** Controladores públicos por diseño: no exigen permiso más allá del JWT. */
const SIN_PERMISO = new Set(['auth.controller.ts', 'health.controller.ts']);

function controllers(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return controllers(full);
    return entry.endsWith('.controller.ts') ? [full] : [];
  });
}

const files = controllers(modulesRoot);

function codesOf(source: string): string[] {
  return [...source.matchAll(/RequirePermissions\('([^']+)'\)/g)].map(match => match[1]);
}

function catalog(): Set<string> {
  const source = readFileSync(seedRbac, 'utf8');
  const start = source.indexOf('export const ALL_PERMISSIONS');
  const end = source.indexOf('];', start);
  const block = source.slice(start, end);

  return new Set([...block.matchAll(/'([^']+)'/g)].map(match => match[1]));
}

describe('Cobertura de permisos en controladores (H-100)', () => {
  it('encuentra los controladores del backend', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('todo controlador de módulo declara @RequirePermissions', () => {
    const sinPermiso = files
      .filter(file => !SIN_PERMISO.has(file.split(/[\\/]/).pop() ?? ''))
      .filter(file => codesOf(readFileSync(file, 'utf8')).length === 0)
      .map(file => file.replace(modulesRoot, '').replace(/\\/g, '/'));

    expect(sinPermiso).toEqual([]);
  });

  it('los códigos usados existen en el catálogo de seed-rbac', () => {
    const granted = catalog();
    const used = new Set(files.flatMap(file => codesOf(readFileSync(file, 'utf8'))));

    const unknown = [...used].filter(code => !granted.has(code)).sort();

    expect(granted.size).toBeGreaterThan(50);
    expect(used.size).toBeGreaterThan(10);
    expect(unknown).toEqual([]);
  });
});
