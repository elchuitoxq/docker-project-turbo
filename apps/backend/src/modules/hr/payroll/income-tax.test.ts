import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { calculateIncomeTax, findBracket, type IncomeTaxBracket } from './income-tax';

/**
 * Tarifa Nº 1 del Art. 50 de la Ley de ISLR: ocho tramos en unidades tributarias con sustraendo
 * que hace continua la tarifa en cada borde. Es la misma tabla que carga el seed.
 */
const BRACKETS: IncomeTaxBracket[] = [
  { fromUt: 0, toUt: 1000, rate: 0.06, discountUt: 0 },
  { fromUt: 1000, toUt: 1500, rate: 0.09, discountUt: 30 },
  { fromUt: 1500, toUt: 2000, rate: 0.12, discountUt: 75 },
  { fromUt: 2000, toUt: 2500, rate: 0.16, discountUt: 155 },
  { fromUt: 2500, toUt: 3000, rate: 0.2, discountUt: 255 },
  { fromUt: 3000, toUt: 4000, rate: 0.24, discountUt: 375 },
  { fromUt: 4000, toUt: 6000, rate: 0.29, discountUt: 575 },
  { fromUt: 6000, toUt: null, rate: 0.34, discountUt: 875 },
];

const UT = 9;

describe('findBracket', () => {
  it('ubica el tramo con el límite inferior inclusive y el superior exclusivo', () => {
    expect(findBracket(BRACKETS, 999.99)?.rate).toBe(0.06);
    expect(findBracket(BRACKETS, 1000)?.rate).toBe(0.09);
    expect(findBracket(BRACKETS, 2499)?.rate).toBe(0.16);
    expect(findBracket(BRACKETS, 2500)?.rate).toBe(0.2);
  });

  it('el último tramo no tiene tope', () => {
    expect(findBracket(BRACKETS, 50_000)?.rate).toBe(0.34);
  });
});

describe('calculateIncomeTax', () => {
  it('aplica tasa y sustraendo del tramo', () => {
    // 2.500 UT al 16 % con sustraendo de 155 UT = 400 − 155 = 245 UT
    const result = calculateIncomeTax(2500 * UT, BRACKETS, { utValue: UT });

    expect(result.taxableUt).toBe(2500);
    expect(result.annualTax).toBe(245 * UT);
    expect(result.monthlyWithholding).toBe(Number(((245 * UT) / 12).toFixed(2)));
  });

  it('la tarifa es continua en el borde de cada tramo', () => {
    const justo = calculateIncomeTax(3000 * UT, BRACKETS, { utValue: UT });
    const anterior = calculateIncomeTax(2999.99 * UT, BRACKETS, { utValue: UT });

    expect(Math.abs(justo.annualTax - anterior.annualTax)).toBeLessThan(1);
  });

  it('el primer tramo no tiene sustraendo', () => {
    const result = calculateIncomeTax(600 * UT, BRACKETS, { utValue: UT });

    expect(result.annualTax).toBe(36 * UT);
  });

  it('el descuento único nunca supera el impuesto', () => {
    const conDescuento = calculateIncomeTax(2500 * UT, BRACKETS, {
      utValue: UT,
      singleDiscount: 99_999,
    });

    expect(conDescuento.discount).toBe(245 * UT);
    expect(conDescuento.annualTaxAfterDiscount).toBe(0);
  });

  it('no deja la retención en negativo con base cero', () => {
    const result = calculateIncomeTax(0, BRACKETS, { utValue: UT });

    expect(result.annualTax).toBe(0);
    expect(result.monthlyWithholding).toBe(0);
  });

  it('falla si falta el valor de la UT o la tabla', () => {
    expect(() => calculateIncomeTax(1000, BRACKETS, { utValue: 0 })).toThrow(BadRequestException);
    expect(() => calculateIncomeTax(1000, [], { utValue: UT })).toThrow(/tramos de ISLR/);
  });

  it('prorratea el impuesto anual en 12 meses sin perder centavos', () => {
    const result = calculateIncomeTax(20_000 * UT, BRACKETS, { utValue: UT });

    expect(result.annualTaxAfterDiscount).toBe(Math.round((20_000 * 0.34 - 875) * UT * 100) / 100);
    expect(result.monthlyWithholding).toBe(Number((result.annualTaxAfterDiscount / 12).toFixed(2)));
  });
});
