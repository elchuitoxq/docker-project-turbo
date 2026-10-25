import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate } from './utils';

describe('utils', () => {
  it('cn() merges classes', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', false && 'b', 'c')).toBe('a c');
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('formatCurrency() formats USD', () => {
    const out = formatCurrency(1234.5, 'USD');
    expect(out).toContain('1');
    expect(out).toMatch(/USD|\$/);
  });

  it('formatCurrency() formats VES', () => {
    const out = formatCurrency(1234.5, 'VES');
    expect(out).toMatch(/1234|1\.234|VES/);
  });

  it('formatDate() formats date', () => {
    const out = formatDate('2026-06-04T00:00:00.000Z');
    expect(out).toMatch(/2026|04|06/);
  });
});
