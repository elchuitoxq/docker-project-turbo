import { BadRequestException } from '@nestjs/common';

/**
 * Retención de ISLR de personas naturales (RN-09 de `09-HR-NOMINA-VENEZUELA.md`).
 *
 * SAP resuelve esto con una **tabla de customizing con vigencia** (tramos en unidades tributarias,
 * tasa y sustraendo) más el valor de la UT del ejercicio; el motor sólo aplica la tabla. Aquí se
 * replica igual: los tramos viven en `income_tax_brackets` y este archivo sólo hace la aritmética,
 * para poder probarla sin base de datos.
 */

export interface IncomeTaxBracket {
  /** Desde, en unidades tributarias (inclusive). */
  fromUt: number;
  /** Hasta, en unidades tributarias (exclusive); `null` = sin tope. */
  toUt: number | null;
  /** Alícuota aplicable al tramo (0,06 = 6 %). */
  rate: number;
  /** Sustraendo del tramo, en unidades tributarias. */
  discountUt: number;
}

export interface IncomeTaxParams {
  /** Valor de la unidad tributaria del ejercicio, en moneda funcional. */
  utValue: number;
  /** Descuento único anual que fija la ley (en moneda funcional). */
  singleDiscount?: number;
}

export interface IncomeTaxResult {
  /** Base gravable anual en unidades tributarias. */
  taxableUt: number;
  /** Impuesto anual antes del descuento único. */
  annualTax: number;
  /** Descuento único aplicado (nunca mayor que el impuesto). */
  discount: number;
  /** Impuesto anual definitivo. */
  annualTaxAfterDiscount: number;
  /** Retención mensual (impuesto anual / 12). */
  monthlyWithholding: number;
  /** Tramo aplicado, tal como quedó en la tabla. */
  bracket: IncomeTaxBracket;
}

function round(value: number, scale = 2): number {
  const factor = 10 ** scale;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Tramo que corresponde a una base anual expresada en UT. */
export function findBracket(
  brackets: IncomeTaxBracket[],
  taxableUt: number
): IncomeTaxBracket | undefined {
  return brackets.find(
    bracket => taxableUt >= bracket.fromUt && (bracket.toUt === null || taxableUt < bracket.toUt)
  );
}

/**
 * Calcula la retención anual y su prorrateo mensual.
 *
 * `annualBase` es la base gravable **anual** en moneda funcional (lo que el run proyecta con
 * desgravámenes ya aplicados). La tarifa es `base_ut × tasa − sustraendo_ut`, todo en UT, y el
 * resultado se multiplica por el valor de la UT.
 */
export function calculateIncomeTax(
  annualBase: number,
  brackets: IncomeTaxBracket[],
  params: IncomeTaxParams
): IncomeTaxResult {
  if (!Number.isFinite(params.utValue) || params.utValue <= 0) {
    throw new BadRequestException(
      'Falta el valor de la unidad tributaria para calcular ISLR (parámetro UNIDAD_TRIBUTARIA)'
    );
  }
  if (brackets.length === 0) {
    throw new BadRequestException('No hay tramos de ISLR vigentes para el ejercicio');
  }
  if (!Number.isFinite(annualBase)) {
    throw new BadRequestException('La base anual de ISLR no es un número válido');
  }

  const taxableUt = Math.max(0, annualBase) / params.utValue;
  // Bajo el mínimo exento no hay retención: el primer tramo arranca en 0 UT con tasa 0.
  const bracket =
    findBracket(brackets, taxableUt) ??
    (taxableUt <= 0 ? brackets[0] : undefined) ??
    brackets[brackets.length - 1];

  const grossAnnualUt = Math.max(0, taxableUt * bracket.rate - bracket.discountUt);
  const annualTax = round(grossAnnualUt * params.utValue);
  const requestedDiscount = Math.max(0, params.singleDiscount ?? 0);
  const discount = round(Math.min(requestedDiscount, annualTax));
  const annualTaxAfterDiscount = round(annualTax - discount);

  return {
    taxableUt: round(taxableUt, 4),
    annualTax,
    discount,
    annualTaxAfterDiscount,
    monthlyWithholding: round(annualTaxAfterDiscount / 12),
    bracket,
  };
}
