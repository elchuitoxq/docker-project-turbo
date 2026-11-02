/**
 * Normaliza el número de referencia de una transacción bancaria (`T-05-01`).
 *
 * La referencia es la prueba de que el dinero entró a la cuenta, así que se guarda y se compara
 * siempre igual: sin espacios sobrantes, con un único espacio entre palabras y en mayúsculas.
 * `zelle-123`, ` ZELLE-123 ` y `Zelle 123` son la misma transferencia y deben chocar contra el
 * índice único de `payments.reference`.
 *
 * Devuelve `null` cuando no hay referencia: vacío no es un número, es la ausencia de él.
 */
export function normalizePaymentReference(reference?: string | null): string | null {
  const normalized = (reference ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

  return normalized.length > 0 ? normalized : null;
}

/** Código de PostgreSQL para violación de restricción única (`unique_violation`). */
const UNIQUE_VIOLATION = '23505';

/**
 * `true` si el error viene de una restricción única de la base.
 *
 * Existe para que la validación del servicio y el índice único no se contradigan: cuando dos
 * formularios simultáneos pasan el chequeo previo, el segundo choca contra la base y debe recibir
 * el mismo conflicto legible en vez de un 500.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate.code === UNIQUE_VIOLATION || candidate.cause?.code === UNIQUE_VIOLATION;
}
