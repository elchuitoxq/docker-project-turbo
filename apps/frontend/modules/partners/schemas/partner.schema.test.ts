import { describe, it, expect } from 'vitest';
import { partnerSchema } from './partner.schema';

describe('partnerSchema', () => {
  it('validates a complete customer', () => {
    const result = partnerSchema.safeParse({
      name: 'Cliente ABC',
      taxId: 'J-12345678-9',
      type: 'CUSTOMER',
      taxpayerType: 'ORDINARY',
      retentionRate: 75,
      isSpecialTaxpayer: false,
      creditLimit: 5000,
      email: 'abc@test.com',
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = partnerSchema.safeParse({ taxId: 'J-1', type: 'CUSTOMER' });
    expect(result.success).toBe(false);
  });

  it('requires taxId', () => {
    const result = partnerSchema.safeParse({ name: 'A', type: 'CUSTOMER' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = partnerSchema.safeParse({
      name: 'A',
      taxId: 'J-1',
      type: 'CUSTOMER',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty email as no email', () => {
    const result = partnerSchema.safeParse({
      name: 'A',
      taxId: 'J-1',
      type: 'CUSTOMER',
      email: '',
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults for retention and credit limit', () => {
    const result = partnerSchema.parse({
      name: 'A',
      taxId: 'J-1',
      type: 'VENDOR',
    });
    expect(result.retentionRate).toBe(0);
    expect(result.creditLimit).toBe(0);
    expect(result.taxpayerType).toBe('ORDINARY');
    expect(result.isSpecialTaxpayer).toBe(false);
  });

  it('coerces string numbers', () => {
    const result = partnerSchema.parse({
      name: 'A',
      taxId: 'J-1',
      type: 'VENDOR',
      retentionRate: '75.5',
      creditLimit: '1000',
    });
    expect(result.retentionRate).toBe(75.5);
    expect(result.creditLimit).toBe(1000);
  });
});
