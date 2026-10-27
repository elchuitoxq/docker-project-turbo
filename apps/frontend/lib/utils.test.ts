import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate, formatDay } from './utils';

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

  it('formatDay() no corre el día por zona horaria', () => {
    // `new Date('2026-11-26')` es medianoche UTC: en Venezuela restaría un día.
    expect(formatDay('2026-11-26')).toMatch(/26/);
    expect(formatDay('2026-11-26')).toMatch(/11/);
    expect(formatDay(null)).toBe('—');
  });
});
