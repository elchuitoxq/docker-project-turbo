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
const SIN_PERMISO = new Set([
  'auth.controller.ts',
  'health.controller.ts',
  // Estado de la tasa: es público para avisar de una tasa vencida antes de autenticar (S-08 §5).
  'rate-health.controller.ts',
]);

/**
 * Rutas autenticadas sin permiso declarado por diseño.
 * - Perfil propio: cada usuario consulta su propia cuenta.
 * - Monedas y tasas son maestros compartidos que se leen antes de elegir sucursal (R5).
 */
const RUTAS_ABIERTAS = new Set([
  'users|Get(me/profile)',
  'settings/currencies|Get()',
  'settings/currencies|Get(rates/latest)',
  'settings/currencies|Get(rates/:code)',
  'settings/currencies|Get(rates/:code/history)',
  // Health check de la tasa: mismo motivo que `settings/currencies|Get(rates/latest)`.
  'health|Get(rates)',
]);

const ROUTE_DECORATOR = /^\s*@(Get|Post|Patch|Put|Delete)\s*\(/;
const METHOD_SIGNATURE = /^\s*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?[A-Za-z_]\w*\s*\(/;
const PERMISSION_DECORATOR = /RequirePermissions\(\s*'([^']+)'/;

type Handler = { route: string; permission: string | null };

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

/**
 * El decorador de permisos puede ir antes o después del decorador de ruta, así que
 * se busca hacia adelante hasta la firma del método y, si no aparece, hacia atrás
 * hasta el cierre del método anterior.
 */
function handlersOf(source: string): Handler[] {
  const lines = source.split(/\r?\n/);
  const firstRoute = lines.findIndex(line => ROUTE_DECORATOR.test(line));
  const classPermission =
    firstRoute === -1
      ? null
      : (lines
          .slice(0, firstRoute)
          .map(line => PERMISSION_DECORATOR.exec(line))
          .find(Boolean)?.[1] ?? null);

  const handlers: Handler[] = [];
  lines.forEach((line, index) => {
    const routeMatch = ROUTE_DECORATOR.exec(line);
    if (!routeMatch) return;

    const args = line
      .slice(routeMatch[0].length)
      .replace(/\)\s*$/, '')
      .replace(/'/g, '');
    let permission: string | null = null;

    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next];
      if (METHOD_SIGNATURE.test(candidate) && !candidate.trim().startsWith('@')) break;
      const match = PERMISSION_DECORATOR.exec(candidate);
      if (match) {
        permission = match[1];
        break;
      }
    }

    if (!permission) {
      for (let previous = index - 1; previous >= 0; previous -= 1) {
        const candidate = lines[previous].trim();
        const closesMember =
          candidate === '}' ||
          ROUTE_DECORATOR.test(lines[previous]) ||
          (METHOD_SIGNATURE.test(lines[previous]) && !candidate.startsWith('@'));
        if (closesMember) break;
        const match = PERMISSION_DECORATOR.exec(lines[previous]);
        if (match) {
          permission = match[1];
          break;
        }
      }
    }

    handlers.push({
      route: `${routeMatch[1]}(${args})`,
      permission: permission ?? classPermission,
    });
  });

  return handlers;
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

  it('toda ruta exige un permiso salvo las abiertas por diseño', () => {
    const sinPermiso = files
      .filter(file => !SIN_PERMISO.has(file.split(/[\\/]/).pop() ?? ''))
      .flatMap(file => {
        const relative = file.replace(modulesRoot, '').replace(/\\/g, '/');
        const module = relative.replace(/^\/+/, '').replace(/\/[^/]+\.controller\.ts$/, '');
        return handlersOf(readFileSync(file, 'utf8'))
          .filter(({ permission }) => permission === null)
          .map(({ route }) => `${module}|${route}`)
          .filter(key => !RUTAS_ABIERTAS.has(key));
      })
      .sort();

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
