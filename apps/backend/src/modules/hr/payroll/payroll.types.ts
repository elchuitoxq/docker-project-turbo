/** Contratos compartidos entre el servicio de nómina y el motor de cálculo (`T-02-03`). */

/** Parámetro ya resuelto (vigente o congelado) que el motor consume. */
export interface PayrollSettingRow {
  key: string;
  value: number;
  /** `PERCENT`, `NUMBER`, `MONEY` o `MONEY_XXX` cuando el valor está en otra moneda. */
  type: string;
}

/** Conversor a la moneda del run con la tasa del período. */
export interface CurrencyConverter {
  convert: (amount: number, fromCurrency: string) => number;
}
