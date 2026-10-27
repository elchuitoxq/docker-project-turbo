/**
 * Resolución de parámetros de nómina por vigencia (`T-02-01`).
 *
 * `payroll_settings` guarda varias filas por clave (una por vigencia y por sucursal). El motor nunca
 * debe leer "la última fila": tiene que resolver qué valor regía en la fecha del período. Eso es lo
 * que hace este módulo, y es la razón por la que un período cerrado se puede reproducir.
 */

export interface PayrollSettingLike {
  id?: string;
  key: string;
  label: string;
  value: string;
  type: string;
  branchId: string | null;
  effectiveFrom: Date;
  isActive?: boolean | null;
}

export interface ResolveSettingsOptions {
  /** Fecha del período que se está calculando (no la fecha de hoy). */
  asOf: Date;
  /** Sucursal del run. Sin sucursal se resuelven sólo los valores de empresa. */
  branchId?: string;
}

/**
 * Devuelve un único valor por clave: el vigente a `asOf`.
 *
 * Precedencia: valor de la sucursal sobre valor de la empresa (RN-23). Si hay dos filas de la misma
 * clave con la misma fecha, gana la específica de la sucursal y, si persiste el empate, la de `id`
 * mayor para que el resultado sea determinista.
 */
export function resolvePayrollSettings<R extends PayrollSettingLike>(
  rows: R[],
  { asOf, branchId }: ResolveSettingsOptions
): R[] {
  const limit = asOf.getTime();
  const selected = new Map<string, R>();

  for (const row of rows) {
    if (row.isActive === false) continue;
    if (row.effectiveFrom.getTime() > limit) continue;

    const belongsToBranch = branchId !== undefined && row.branchId === branchId;
    const isCompanyWide = row.branchId === null;
    if (!belongsToBranch && !isCompanyWide) continue;

    const current = selected.get(row.key);
    if (!current || isMoreSpecific(row, current)) {
      selected.set(row.key, row);
    }
  }

  return [...selected.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function isMoreSpecific<R extends PayrollSettingLike>(candidate: R, current: R): boolean {
  const candidateAt = candidate.effectiveFrom.getTime();
  const currentAt = current.effectiveFrom.getTime();
  if (candidateAt !== currentAt) return candidateAt > currentAt;

  const candidateBranch = candidate.branchId !== null;
  const currentBranch = current.branchId !== null;
  if (candidateBranch !== currentBranch) return candidateBranch;

  // Empate real (misma clave, misma fecha, misma sucursal): se rompe por `id` para que el
  // resultado no dependa del orden en que la base devolvió las filas.
  if (candidate.id !== undefined && current.id !== undefined) {
    return candidate.id > current.id;
  }

  return false;
}

/**
 * Escala de los parámetros porcentuales: el valor se guarda como porcentaje entero (`4` = 4 %).
 * Devuelve el mensaje de error o `null` si el valor es admisible.
 */
export function validateSettingValue(type: string, value: number): string | null {
  if (!Number.isFinite(value)) return 'El valor debe ser un número finito';

  if (isPercentType(type)) {
    if (value <= 0 || value > 100) {
      return `Un parámetro porcentual se expresa como porcentaje entero: "${value}" está fuera de (0, 100]`;
    }
  } else if (value < 0) {
    return 'El valor no puede ser negativo';
  }

  return null;
}

export function isPercentType(type: string): boolean {
  const normalized = type.trim().toUpperCase();
  return normalized === 'PERCENT' || normalized === 'PERCENTAGE';
}
