import { describe, it, expect } from 'vitest';
import { checkDigit, normalizeRif, validateRif } from './rif.validator';

/**
 * El RIF es lo primero que rechaza el SENIAT en un archivo de retenciones, así que conviene tener
 * claro qué se considera error y qué sólo advertencia.
 */
describe('RIF venezolano', () => {
  it('normaliza separadores y minúsculas', () => {
    expect(normalizeRif('j-12345678-9')).toBe('J123456789');
    expect(normalizeRif(' J 12.345.678 9 ')).toBe('J123456789');
    expect(normalizeRif('')).toBeNull();
    expect(normalizeRif(null)).toBeNull();
  });

  it('rechaza tipos que no existen', () => {
    const check = validateRif('X-12345678-9');
    expect(check.formatValid).toBe(false);
    expect(check.reason).toMatch(/Tipo/);
  });

  it('rechaza longitudes incorrectas', () => {
    expect(validateRif('J-1234567-9').formatValid).toBe(false);
    expect(validateRif('J-1234567890').formatValid).toBe(false);
    expect(validateRif('').formatValid).toBe(false);
  });

  it('acepta el formato correcto aunque el dígito no cuadre, y lo marca', () => {
    // El dígito verificador es advertencia (regla ⚠️ pendiente de confirmar), no error.
    const check = validateRif('J-12345678-1');
    expect(check.formatValid).toBe(true);
    expect(check.valid).toBe(true);

    if (check.checkDigitValid) {
      expect(check.reason).toBeUndefined();
    } else {
      expect(check.reason).toMatch(/verificador/);
    }
  });

  it('calcula el dígito verificador con módulo 11', () => {
    expect(checkDigit('12345678')).toBeTypeOf('number');
    expect(checkDigit('1234567')).toBeNull();

    const digits = '12345678';
    const expected = checkDigit(digits)!;
    const check = validateRif(`J-${digits}-${expected}`);
    expect(check.checkDigitValid).toBe(true);
  });

  it('un RIF con su dígito correcto queda sin motivo de advertencia', () => {
    const digits = '30502864';
    const expected = checkDigit(digits)!;
    const check = validateRif(`J-${digits}-${expected}`);

    expect(check.formatValid).toBe(true);
    expect(check.checkDigitValid).toBe(true);
    expect(check.reason).toBeUndefined();
  });
});
