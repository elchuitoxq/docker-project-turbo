import { describe, it, expect } from 'vitest';
import { productSchema } from './product.schema';

describe('productSchema', () => {
  it('validates a complete product', () => {
    const result = productSchema.safeParse({
      sku: 'SKU-1',
      name: 'Laptop',
      type: 'PHYSICAL',
      cost: 800,
      price: 1200,
      taxRate: 16,
      minStock: 5,
    });
    expect(result.success).toBe(true);
  });

  it('requires sku', () => {
    const result = productSchema.safeParse({ name: 'X' });
    expect(result.success).toBe(false);
  });

  it('requires name', () => {
    const result = productSchema.safeParse({ sku: 'X' });
    expect(result.success).toBe(false);
  });

  it('applies defaults', () => {
    const r = productSchema.parse({ sku: 'A', name: 'B' });
    expect(r.type).toBe('PHYSICAL');
    expect(r.cost).toBe(0);
    expect(r.price).toBe(0);
    expect(r.taxRate).toBe(16);
    expect(r.minStock).toBe(0);
    expect(r.isExempt).toBe(false);
    expect(r.hasBatches).toBe(false);
  });

  it('rejects negative cost', () => {
    const r = productSchema.safeParse({ sku: 'A', name: 'B', cost: -1 });
    expect(r.success).toBe(false);
  });

  it('rejects taxRate > 100', () => {
    const r = productSchema.safeParse({ sku: 'A', name: 'B', taxRate: 150 });
    expect(r.success).toBe(false);
  });
});
