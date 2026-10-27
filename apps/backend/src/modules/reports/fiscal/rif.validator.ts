/**
 * Validación de RIF venezolano (SENIAT).
 *
 * Formato: tipo (`V`, `E`, `J`, `G`, `P`, `C`) + 8 dígitos + dígito verificador.
 *
 * El dígito verificador se calcula con módulo 11 y pesos `3,2,7,6,5,4,3,2`. **El tratamiento del
 * residuo 10 no está confirmado** contra la Providencia 0102 (unas referencias lo llevan a 0 y otras
 * lo declaran inválido), así que un dígito que no cuadra se reporta como **advertencia**, no como
 * error: bloquear una exportación fiscal por una regla mal copiada sería peor que avisar. El formato
 * sí es un error.
 */

export type RifCheck = {
  value: string;
  normalized: string | null;
  formatValid: boolean;
  checkDigitValid: boolean;
  /** `true` sólo si el formato es válido; el dígito verificador suma una advertencia. */
  valid: boolean;
  reason?: string;
};

const ALLOWED_TYPES = new Set(['V', 'E', 'J', 'G', 'P', 'C']);
const WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2];

export function normalizeRif(raw?: string | null): string | null {
  if (!raw) return null;

  const compact = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();

  return compact.length > 0 ? compact : null;
}

export function checkDigit(digits: string): number | null {
  if (!/^\d{8}$/.test(digits)) return null;

  const sum = WEIGHTS.reduce((acc, weight, index) => acc + Number(digits[index]) * weight, 0);
  const computed = 11 - (sum % 11);

  if (computed === 11 || computed === 10) return 0;
  return computed;
}

export function validateRif(raw?: string | null): RifCheck {
  const value = raw ?? '';
  const normalized = normalizeRif(raw);

  if (!normalized) {
    return {
      value,
      normalized: null,
      formatValid: false,
      checkDigitValid: false,
      valid: false,
      reason: 'RIF vacío',
    };
  }

  const type = normalized[0];
  const digits = normalized.slice(1, 9);
  const verifier = normalized.slice(9);

  if (!ALLOWED_TYPES.has(type)) {
    return {
      value,
      normalized,
      formatValid: false,
      checkDigitValid: false,
      valid: false,
      reason: `Tipo de RIF desconocido: ${type}`,
    };
  }

  if (normalized.length !== 10 || !/^\d{8}$/.test(digits) || !/^\d$/.test(verifier)) {
    return {
      value,
      normalized,
      formatValid: false,
      checkDigitValid: false,
      valid: false,
      reason: 'El RIF debe tener 8 dígitos y un dígito verificador',
    };
  }

  const expected = checkDigit(digits);
  const checkDigitValid = expected !== null && expected === Number(verifier);

  return {
    value,
    normalized,
    formatValid: true,
    checkDigitValid,
    valid: true,
    ...(checkDigitValid
      ? {}
      : { reason: `Dígito verificador no coincide (se esperaba ${expected})` }),
  };
}
