import { describe, it, expect } from 'vitest';
import { cn, formatMoney, formatDate, formatDateTime, formatDay, formatDual } from './utils';

describe('utils', () => {
  it('cn() merges classes', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', false && 'b', 'c')).toBe('a c');
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('formatMoney() formats USD', () => {
    const out = formatMoney(1234.5, 'USD');
    expect(out).toContain('1');
    expect(out).toMatch(/USD|\$/);
  });

  it('formatMoney() formats VES', () => {
    const out = formatMoney(1234.5, 'VES');
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

  it('formatDual() muestra el monto del documento y su equivalente en base', () => {
    const usd = formatDual(100, 'USD', 40);
    expect(usd).toContain(formatMoney(100, 'USD'));
    expect(usd).toContain(formatMoney(4000, 'VES'));
  });

  it('formatDual() no duplica la moneda funcional', () => {
    // Un documento en VES ya está en base: repetirlo como "equivalente" haría creer que se convirtió.
    expect(formatDual(4000, 'VES', 40)).toBe(formatMoney(4000, 'VES'));
  });

  it('formatDual() con tasa inválida devuelve sólo el monto original', () => {
    expect(formatDual(100, 'USD', 0)).toBe(formatMoney(100, 'USD'));
    expect(formatDual(100, 'USD', Number.NaN)).toBe(formatMoney(100, 'USD'));
  });

  it('formatDateTime() incluye la hora del histórico', () => {
    const out = formatDateTime('2026-10-30T18:22:00.000Z');
    expect(out).toContain('2026');
    expect(out).toMatch(/\d{2}:\d{2}/);
  });

  it('formatDateTime() sobrevive a valores vacíos o inválidos', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('no-es-fecha')).toBe('no-es-fecha');
  });
});
