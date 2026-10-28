import { describe, expect, it } from 'vitest';
import { findRate, isRateStale, MAX_RATE_AGE_DAYS, rateAgeInDays } from './rates';

const TODAY = new Date(2026, 9, 27, 15, 30); // 27-oct-2026, hora local

describe('rateAgeInDays', () => {
  it('cuenta días completos entre la tasa y hoy', () => {
    expect(rateAgeInDays('2026-10-27', TODAY)).toBe(0);
    expect(rateAgeInDays('2026-10-26', TODAY)).toBe(1);
    expect(rateAgeInDays('2026-10-20', TODAY)).toBe(7);
  });

  it('acepta la fecha con hora y toma sólo el día', () => {
    expect(rateAgeInDays('2026-10-26T23:59:59.000Z', TODAY)).toBe(1);
  });

  it('devuelve null cuando no hay fecha', () => {
    expect(rateAgeInDays(null, TODAY)).toBeNull();
    expect(rateAgeInDays('', TODAY)).toBeNull();
  });
});

describe('isRateStale', () => {
  it('la tasa de hoy y la de ayer sirven', () => {
    expect(isRateStale('2026-10-27', MAX_RATE_AGE_DAYS, TODAY)).toBe(false);
    expect(isRateStale('2026-10-26', MAX_RATE_AGE_DAYS, TODAY)).toBe(false);
  });

  it('marca vencida la tasa de hace dos días o más', () => {
    expect(isRateStale('2026-10-25', MAX_RATE_AGE_DAYS, TODAY)).toBe(true);
  });

  it('sin fecha se considera vencida', () => {
    expect(isRateStale(null, MAX_RATE_AGE_DAYS, TODAY)).toBe(true);
  });

  it('una fecha futura también se rechaza', () => {
    expect(isRateStale('2026-10-30', MAX_RATE_AGE_DAYS, TODAY)).toBe(true);
  });
});

describe('findRate', () => {
  const rates = [
    { id: '1', rate: 40, date: '2026-10-27', source: 'BCV', currencyCode: 'VES' },
    { id: '2', rate: 1, date: '2026-10-27', source: 'BCV', currencyCode: 'USD' },
  ];

  it('encuentra la tasa de la moneda pedida', () => {
    expect(findRate(rates, 'VES')?.rate).toBe(40);
  });

  it('devuelve undefined si no hay tasa o no se pidió moneda', () => {
    expect(findRate(rates, 'EUR')).toBeUndefined();
    expect(findRate(rates, null)).toBeUndefined();
    expect(findRate(undefined, 'VES')).toBeUndefined();
  });
});
