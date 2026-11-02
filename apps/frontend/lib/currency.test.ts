import { describe, it, expect } from 'vitest';
import { buildCurrencyIndex, type Currency } from './currency';

const USD: Currency = { id: 'usd-id', code: 'USD', name: 'Dólar', symbol: '$', isBase: false };
const VES: Currency = { id: 'ves-id', code: 'VES', name: 'Bolívar', symbol: 'Bs.', isBase: true };

describe('buildCurrencyIndex', () => {
  it('resuelve el código de la moneda funcional declarada', () => {
    const index = buildCurrencyIndex([USD, VES]);
    expect(index.baseCode).toBe('VES');
  });

  it('traduce el currencyId de un documento a su código', () => {
    const index = buildCurrencyIndex([USD, VES]);
    expect(index.codeOf('usd-id')).toBe('USD');
    expect(index.codeOf('ves-id')).toBe('VES');
    expect(index.symbolOf('usd-id')).toBe('$');
  });

  it('cae a la moneda funcional cuando el id no se conoce', () => {
    const index = buildCurrencyIndex([USD, VES]);
    expect(index.codeOf(null)).toBe('VES');
    expect(index.codeOf('desconocido')).toBe('VES');
  });

  it('sin catálogo no asume USD', () => {
    const index = buildCurrencyIndex(undefined);
    expect(index.baseCode).toBe('VES');
    expect(index.codeOf('usd-id')).toBe('VES');
  });
});
