import { entityArticle, fieldLabel } from './audit-catalog';

/** Campos técnicos que cambian en cada escritura y sólo ensucian el diff. */
const IGNORED_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
  'password',
  'refreshToken',
  'refresh_token',
]);

/** Campos que no deben llegar nunca al registro de auditoría. */
const SECRET_FIELDS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
]);

export interface AuditDiff {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedFields: string[];
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

/** Fila de base de datos -> objeto plano comparable (fechas a ISO, sin campos técnicos ni nulos). */
export function normalizeRow(
  row: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!row) return {};
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key, value]) => !IGNORED_FIELDS.has(key) && value !== undefined)
      .map(([key, value]) => [key, normalizeValue(value)])
  );
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null);
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  // Postgres devuelve `numeric` como string: 100.00 y 100 son el mismo monto.
  if (typeof a === 'string' || typeof b === 'string') return String(a) === String(b);
  return false;
}

/**
 * Compara la fila antes y después de la escritura y devuelve sólo lo que cambió.
 *
 * `null` cuando no hay nada que contar (un `PATCH` que no modificó ningún campo) o cuando no hay
 * filas en ninguno de los dos lados.
 */
export function diffSnapshot(
  beforeRow: Record<string, unknown> | null | undefined,
  afterRow: Record<string, unknown> | null | undefined
): AuditDiff | null {
  if (!beforeRow && !afterRow) return null;

  const before = normalizeRow(beforeRow);
  const after = normalizeRow(afterRow);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    field => !IGNORED_FIELDS.has(field)
  );

  const changedFields = fields.filter(field => !sameValue(before[field], after[field]));
  if (changedFields.length === 0) return null;

  const pick = (source: Record<string, unknown>) =>
    Object.fromEntries(changedFields.map(field => [field, source[field] ?? null]));

  return { before: pick(before), after: pick(after), changedFields };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 60);
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** "estado: DRAFT → POSTED · total: 100 → 120" con un máximo de campos para no inflar la fila. */
export function summarizeDiff(diff: AuditDiff | null | undefined, maxFields = 3): string {
  if (!diff) return '';
  return diff.changedFields
    .slice(0, maxFields)
    .map(
      field =>
        `${fieldLabel(field)}: ${formatValue(diff.before[field])} → ${formatValue(diff.after[field])}`
    )
    .join(' · ');
}

/**
 * Frase del hecho: "Publicó la factura FAC-000123 · estado: DRAFT → POSTED".
 *
 * Es lo que lee el usuario en el visor, así que prioriza el verbo y el documento sobre la ruta HTTP.
 */
export function describeAuditEvent(input: {
  verb: string;
  entityLabel?: string | null;
  documentCode?: string | null;
  diff?: AuditDiff | null;
  fallback?: string | null;
}): string {
  const { verb, entityLabel, documentCode, diff, fallback } = input;
  if (!entityLabel) return fallback ?? verb;

  const target = `${entityArticle(entityLabel)} ${entityLabel}${documentCode ? ` ${documentCode}` : ''}`;
  const summary = summarizeDiff(diff);
  return summary ? `${verb} ${target} · ${summary}` : `${verb} ${target}`;
}

/** El interceptor guarda el cuerpo de la petición: aquí se quitan los secretos. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => redactSecrets(item));
  if (!value || typeof value !== 'object' || value instanceof Date) return value ?? null;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SECRET_FIELDS.has(key) ? '[redacted]' : redactSecrets(item),
    ])
  );
}
