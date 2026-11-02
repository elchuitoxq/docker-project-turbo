import { describe, expect, it } from 'vitest';
import { isUniqueViolation, normalizePaymentReference } from './payment-reference';

describe('normalizePaymentReference', () => {
  it('quita espacios sobrantes y pasa a mayúsculas', () => {
    expect(normalizePaymentReference('  zelle-123 ')).toBe('ZELLE-123');
    expect(normalizePaymentReference('zelle   123')).toBe('ZELLE 123');
    expect(normalizePaymentReference('Zelle 123')).toBe('ZELLE 123');
  });

  it('trata vacío, espacios y nulo como «sin referencia»', () => {
    expect(normalizePaymentReference('')).toBeNull();
    expect(normalizePaymentReference('   ')).toBeNull();
    expect(normalizePaymentReference(null)).toBeNull();
    expect(normalizePaymentReference(undefined)).toBeNull();
  });
});

describe('isUniqueViolation', () => {
  it('reconoce la violación de restricción única del driver y de su causa', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true);
  });

  it('ignora otros errores', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
