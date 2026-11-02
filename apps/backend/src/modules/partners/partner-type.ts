import { eq, inArray, type SQL } from 'drizzle-orm';
import { partners } from '../../schema';

export const PARTNER_TYPES = ['CUSTOMER', 'VENDOR', 'BOTH'] as const;

export type PartnerType = (typeof PARTNER_TYPES)[number];

/**
 * Normaliza el tipo de partner. `BOTH` cumple ambos roles comerciales y `SUPPLIER` se
 * conserva como alias historico de `VENDOR` (datos sembrados con el nombre anterior).
 */
export function normalizePartnerType(type?: string | null): PartnerType {
  const value = (type ?? 'CUSTOMER').toUpperCase();
  if (value === 'SUPPLIER') return 'VENDOR';
  return (PARTNER_TYPES as readonly string[]).includes(value) ? (value as PartnerType) : 'CUSTOMER';
}

export function isCustomerType(type?: string | null): boolean {
  return normalizePartnerType(type) !== 'VENDOR';
}

export function isVendorType(type?: string | null): boolean {
  return normalizePartnerType(type) !== 'CUSTOMER';
}

/** Filtro SQL por rol: `CUSTOMER`/`VENDOR` incluyen a los partners `BOTH`. */
export function partnerTypeCondition(type?: string | null): SQL | undefined {
  if (!type) return undefined;

  switch (normalizePartnerType(type)) {
    case 'CUSTOMER':
      return inArray(partners.type, ['CUSTOMER', 'BOTH']);
    case 'VENDOR':
      return inArray(partners.type, ['VENDOR', 'SUPPLIER', 'BOTH']);
    default:
      return eq(partners.type, 'BOTH');
  }
}
