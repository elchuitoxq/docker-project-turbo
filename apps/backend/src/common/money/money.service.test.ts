import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { MoneyService } from './money.service';

describe('MoneyService', () => {
  const money = new MoneyService();

  it('convierte a moneda base multiplicando por la tasa', () => {
    expect(money.toBase('100.00', '36.50').toFixed(2)).toBe('3650.00');
  });

  it('convierte desde la moneda base dividiendo por la tasa', () => {
    expect(money.fromBase('3650.00', '36.50').toFixed(2)).toBe('100.00');
  });

  it('no pierde precisión en montos grandes ni en tasas con muchos decimales', () => {
    const base = money.toBase('1234567.89', '36.5432109876');
    expect(money.round(base, 2)).toBe('45115074.88');
  });

  it('redondea HALF_UP al persistir', () => {
    expect(money.round(new Decimal('10.005'), 2)).toBe('10.01');
    expect(money.round(new Decimal('10.004'), 2)).toBe('10.00');
  });

  it('respeta la política DOWN cuando se pide', () => {
    expect(money.round(new Decimal('10.019'), 2, 'DOWN')).toBe('10.01');
  });

  it('suma sin arrastrar error de coma flotante', () => {
    expect(money.sum(['0.10', '0.20'])).toBe('0.30');
    expect(money.sum(['10.15', '20.15', '30.15'])).toBe('60.45');
    expect(money.sum([])).toBe('0.00');
  });

  it('compara montos hasta la escala indicada', () => {
    expect(money.equals('100.004', '100.00')).toBe(true);
    expect(money.equals('100.02', '100.00')).toBe(false);
  });

  it('rechaza tasas iguales o menores a cero', () => {
    expect(() => money.toBase('10', '0')).toThrow(RangeError);
    expect(() => money.toBase('10', '-5')).toThrow(RangeError);
    expect(() => money.fromBase('10', '0')).toThrow(RangeError);
  });

  it('rechaza tasas no numéricas', () => {
    expect(() => money.toBase('10', 'abc')).toThrow();
  });
});
