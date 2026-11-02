import { PERMISSIONS } from '@/lib/permissions';
import type { AccessLevel, GuideModule, GuideRole, GuideSubmodule } from './types';

/** Aplana el árbol de `PERMISSIONS` a la lista de códigos reales del sistema. */
export function flattenPermissions(node: unknown = PERMISSIONS): string[] {
  if (typeof node === 'string') return [node];
  if (!node || typeof node !== 'object') return [];
  return Object.values(node as Record<string, unknown>).flatMap(flattenPermissions);
}

export const ALL_PERMISSION_CODES: readonly string[] = flattenPermissions();

export function toPermissionSet(source: readonly string[] | ReadonlySet<string>): Set<string> {
  return new Set(source);
}

export function can(granted: ReadonlySet<string>, code: string | undefined): boolean {
  if (!code) return true;
  return granted.has(code);
}

/** Permiso de entrada a la pantalla del submódulo. */
export function canOpenSubmodule(granted: ReadonlySet<string>, submodule: GuideSubmodule): boolean {
  const allOk = can(granted, submodule.viewPermission);
  const anyOk = submodule.viewAnyPermissions?.length
    ? submodule.viewAnyPermissions.some(code => granted.has(code))
    : true;
  return allOk && anyOk;
}

/**
 * Nivel de acceso a un submódulo:
 * - `none`: ni siquiera puede abrir la pantalla.
 * - `partial`: entra, pero le faltan acciones del flujo.
 * - `full`: entra y puede ejecutar todas las acciones documentadas.
 */
export function submoduleAccess(
  granted: ReadonlySet<string>,
  submodule: GuideSubmodule
): AccessLevel {
  if (!canOpenSubmodule(granted, submodule)) return 'none';
  return submodule.actions.every(action => granted.has(action.permission)) ? 'full' : 'partial';
}

export type ModuleSummary = {
  total: number;
  full: number;
  partial: number;
  none: number;
  /** Porcentaje de submódulos que puede abrir (0-100). */
  coverage: number;
};

export function moduleSummary(granted: ReadonlySet<string>, guide: GuideModule): ModuleSummary {
  const total = guide.submodules.length;
  let full = 0;
  let partial = 0;
  let none = 0;

  for (const submodule of guide.submodules) {
    const level = submoduleAccess(granted, submodule);
    if (level === 'full') full += 1;
    else if (level === 'partial') partial += 1;
    else none += 1;
  }

  return {
    total,
    full,
    partial,
    none,
    coverage: total === 0 ? 0 : Math.round(((full + partial) / total) * 100),
  };
}

/** Permisos únicos que la guía del módulo referencia, en orden de aparición. */
export function modulePermissions(guide: GuideModule): string[] {
  const codes = new Set<string>([guide.permission]);
  for (const submodule of guide.submodules) {
    if (submodule.viewPermission) codes.add(submodule.viewPermission);
    for (const code of submodule.viewAnyPermissions ?? []) codes.add(code);
    for (const action of submodule.actions) codes.add(action.permission);
  }
  return [...codes];
}

export function rolePermissions(role: GuideRole): string[] {
  return role.permissions ?? [...ALL_PERMISSION_CODES];
}

export type MatrixCell = { submoduleId: string; level: AccessLevel };

/** Matriz rol × submódulo para el módulo indicado. */
export function permissionMatrix(
  guide: GuideModule,
  roles: readonly GuideRole[]
): { role: GuideRole; cells: MatrixCell[] }[] {
  return roles.map(role => {
    const granted = toPermissionSet(rolePermissions(role));
    return {
      role,
      cells: guide.submodules.map(submodule => ({
        submoduleId: submodule.id,
        level: submoduleAccess(granted, submodule),
      })),
    };
  });
}

export type SearchResult = {
  moduleId: GuideModule['id'];
  moduleTitle: string;
  submoduleId: string;
  submoduleTitle: string;
  level: AccessLevel;
};

function submoduleHaystack(submodule: GuideSubmodule): string {
  return [
    submodule.title,
    submodule.summary,
    ...submodule.steps,
    ...submodule.rules,
    ...submodule.actions.map(action => `${action.label} ${action.permission}`),
    ...submodule.pitfalls.map(pitfall => `${pitfall.symptom} ${pitfall.cause}`),
  ]
    .join(' ')
    .toLowerCase();
}

/** Busca procesos por título, permiso, paso o regla en todos los módulos. */
export function searchGuides(
  modules: readonly GuideModule[],
  granted: ReadonlySet<string>,
  query: string
): SearchResult[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const results: SearchResult[] = [];
  for (const guide of modules) {
    for (const submodule of guide.submodules) {
      if (!submoduleHaystack(submodule).includes(term)) continue;
      results.push({
        moduleId: guide.id,
        moduleTitle: guide.title,
        submoduleId: submodule.id,
        submoduleTitle: submodule.title,
        level: submoduleAccess(granted, submodule),
      });
    }
  }
  return results;
}

export function matchesQuery(submodule: GuideSubmodule, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return submoduleHaystack(submodule).includes(term);
}
