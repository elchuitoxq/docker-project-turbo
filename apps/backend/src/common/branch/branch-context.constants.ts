/** Cabecera con la que el cliente declara la sucursal activa (ver `S-00`). */
export const BRANCH_ID_HEADER = 'x-branch-id';

/** Permiso que habilita operar en modo consolidado sobre cualquier sucursal. */
export const CORE_BRANCH_ALL = 'core:branch:all';

/** Permiso de escritura sobre maestros compartidos (`partners`, `products`, `banks`...). */
export const CORE_CATALOG_MANAGE = 'core:catalog:manage';

/** Clave de metadata para eximir un endpoint del contexto de sucursal. */
export const SKIP_BRANCH_KEY = 'skipBranch';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
