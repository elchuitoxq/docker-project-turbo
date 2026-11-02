import { describe, it, expect } from 'vitest';
import {
  isCustomerType,
  isVendorType,
  normalizePartnerType,
  partnerTypeCondition,
} from './partner-type';

describe('partner-type', () => {
  it('normalizes BOTH and the legacy SUPPLIER alias', () => {
    expect(normalizePartnerType('BOTH')).toBe('BOTH');
    expect(normalizePartnerType('supplier')).toBe('VENDOR');
    expect(normalizePartnerType(null)).toBe('CUSTOMER');
  });

  it('treats BOTH as customer and vendor', () => {
    expect(isCustomerType('BOTH')).toBe(true);
    expect(isVendorType('BOTH')).toBe(true);
    expect(isCustomerType('VENDOR')).toBe(false);
    expect(isVendorType('CUSTOMER')).toBe(false);
  });

  it('builds a role filter only when a type is provided', () => {
    expect(partnerTypeCondition(undefined)).toBeUndefined();
    expect(partnerTypeCondition('CUSTOMER')).toBeDefined();
    expect(partnerTypeCondition('VENDOR')).toBeDefined();
    expect(partnerTypeCondition('BOTH')).toBeDefined();
  });
});
