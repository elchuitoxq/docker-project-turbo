import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

/** Política de redondeo de montos (regla M7 de `S-08`). */
export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'DOWN';

const ROUNDING: Record<RoundingMode, Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  DOWN: Decimal.ROUND_DOWN,
};

/**
 * Único punto autorizado para convertir y redondear dinero (regla M4 de `S-08`).
 *
 * `rate` se expresa como **unidades de moneda base por 1 unidad de la moneda del
 * documento**: `base = amount * rate`. Para el dólar eso es "bolívares por dólar".
 */
@Injectable()
export class MoneyService {
  /** Decimales de la moneda base al persistir. */
  static readonly BASE_SCALE = 2;

  /** Convierte un monto a la moneda base aplicando la tasa recibida. */
  toBase(amount: string | number, rate: string | number): Decimal {
    return new Decimal(amount).times(this.parseRate(rate));
  }

  /** Convierte desde la moneda base a otra moneda con la tasa recibida. */
  fromBase(amountBase: string | number, rate: string | number): Decimal {
    return new Decimal(amountBase).dividedBy(this.parseRate(rate));
  }

  /**
   * Redondea al número de decimales de la moneda. El cálculo intermedio **nunca**
   * se redondea: sólo se aplica al persistir o al presentar.
   */
  round(
    value: Decimal | string | number,
    scale = MoneyService.BASE_SCALE,
    mode: RoundingMode = 'HALF_UP'
  ): string {
    const decimals = value instanceof Decimal ? value : new Decimal(value);
    return decimals.toDecimalPlaces(scale, ROUNDING[mode]).toFixed(scale);
  }

  /** Suma una colección de montos sin perder precisión. */
  sum(values: Array<string | number>, scale = MoneyService.BASE_SCALE): string {
    const total = values.reduce<Decimal>(
      (acc, value) => acc.plus(new Decimal(value)),
      new Decimal(0)
    );
    return this.round(total, scale);
  }

  /** `true` si ambos montos son iguales hasta la escala indicada. */
  equals(a: string | number, b: string | number, scale = MoneyService.BASE_SCALE): boolean {
    return this.round(a, scale) === this.round(b, scale);
  }

  private parseRate(rate: string | number): Decimal {
    const exchangeRate = new Decimal(rate);

    if (!exchangeRate.isFinite() || exchangeRate.lessThanOrEqualTo(0)) {
      throw new RangeError(`Invalid exchange rate: ${rate}`);
    }

    return exchangeRate;
  }
}
