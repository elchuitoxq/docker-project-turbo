import { MoneyService } from '../../../common/money/money.service';

/**
 * Prestaciones, vacaciones y utilidades (`T-02-04`).
 *
 * Cada regla de la LOTTT que admite discusión queda como **parámetro**: días base, topes y días de
 * retroactivo salen de `payroll_settings`, nunca del código. Lo que la ley fija (que existan dos
 * modalidades de prestaciones y se pague la mayor) sí está aquí, porque no es configurable.
 *
 * Ver `docs/09-HR-NOMINA-VENEZUELA.md` §8.3 y §8.4.
 */

export interface BenefitSettings {
  DIAS_VACACIONES_BASE: number;
  TOPE_DIAS_VACACIONES_EXTRA: number;
  DIAS_BONO_VACACIONAL: number;
  TOPE_DIAS_BONO_EXTRA: number;
  DIAS_GARANTIA_TRIMESTRE: number;
  DIAS_ADICIONALES_ANIO: number;
  TOPE_DIAS_ADICIONALES: number;
  DIAS_UTILIDADES: number;
  TOPE_UTILIDADES_MESES: number;
  /** ⚠️ Días por año de la modalidad retroactiva del Art. 142 literal “b”. Validar (P-28). */
  DIAS_RETROACTIVO_ANIO: number;
}

/** Valores legales por defecto; el servicio los sobreescribe con los parámetros vigentes. */
export const DEFAULT_BENEFIT_SETTINGS: BenefitSettings = {
  DIAS_VACACIONES_BASE: 15,
  TOPE_DIAS_VACACIONES_EXTRA: 15,
  DIAS_BONO_VACACIONAL: 7,
  TOPE_DIAS_BONO_EXTRA: 21,
  DIAS_GARANTIA_TRIMESTRE: 15,
  DIAS_ADICIONALES_ANIO: 2,
  TOPE_DIAS_ADICIONALES: 30,
  DIAS_UTILIDADES: 30,
  TOPE_UTILIDADES_MESES: 4,
  DIAS_RETROACTIVO_ANIO: 30,
};

export interface VacationEntitlement {
  years: number;
  vacationDays: number;
  bonusDays: number;
}

export interface BenefitsModality {
  guaranteeAccumulated: number;
  retroactive: number;
  /** La modalidad que se paga: la mayor (RN-11). */
  payable: number;
  modality: 'GUARANTEE' | 'RETROACTIVE';
}

export interface QuarterlyDeposit {
  days: number;
  baseDays: number;
  additionalDays: number;
  amount: number;
}

export interface ProfitSharing {
  days: number;
  monthsWorked: number;
  amount: number;
}

export class BenefitCalculationError extends Error {}

export class LaborBenefits {
  constructor(private readonly money: MoneyService = new MoneyService()) {}

  /** Años de servicio cumplidos entre dos fechas. */
  serviceYears(hireDate: Date, asOf: Date): number {
    if (asOf.getTime() < hireDate.getTime()) return 0;

    let years = asOf.getUTCFullYear() - hireDate.getUTCFullYear();
    const anniversary = Date.UTC(
      hireDate.getUTCFullYear() + years,
      hireDate.getUTCMonth(),
      hireDate.getUTCDate()
    );
    if (asOf.getTime() < anniversary) years -= 1;

    return Math.max(0, years);
  }

  /** Días de vacaciones y de bono vacacional según antigüedad (RN-14, RN-15). */
  vacationEntitlement(
    years: number,
    settings: BenefitSettings = DEFAULT_BENEFIT_SETTINGS
  ): VacationEntitlement {
    const extraYears = Math.max(0, years - 1);

    return {
      years,
      vacationDays:
        settings.DIAS_VACACIONES_BASE + Math.min(extraYears, settings.TOPE_DIAS_VACACIONES_EXTRA),
      bonusDays:
        settings.DIAS_BONO_VACACIONAL + Math.min(extraYears, settings.TOPE_DIAS_BONO_EXTRA),
    };
  }

  /** Días adicionales acumulados de prestaciones (Art. 142 literal “b”, RN-12). */
  additionalBenefitDays(
    years: number,
    settings: BenefitSettings = DEFAULT_BENEFIT_SETTINGS
  ): number {
    const extraYears = Math.max(0, years - 1);
    return Math.min(extraYears * settings.DIAS_ADICIONALES_ANIO, settings.TOPE_DIAS_ADICIONALES);
  }

  /**
   * Depósito de garantía de un trimestre (Art. 142 literal “a”).
   * Los días adicionales se suman en el trimestre en que se cumple el aniversario.
   */
  quarterlyDeposit(
    integralDaily: number,
    years: number,
    isAnniversaryQuarter: boolean,
    settings: BenefitSettings = DEFAULT_BENEFIT_SETTINGS
  ): QuarterlyDeposit {
    if (integralDaily < 0) {
      throw new BenefitCalculationError('El salario integral no puede ser negativo');
    }

    const additionalDays = isAnniversaryQuarter ? this.additionalBenefitDays(years, settings) : 0;
    const days = settings.DIAS_GARANTIA_TRIMESTRE + additionalDays;

    return {
      baseDays: settings.DIAS_GARANTIA_TRIMESTRE,
      additionalDays,
      days,
      amount: Number(this.money.round(integralDaily * days)),
    };
  }

  /**
   * Garantía acumulada (Art. 142 literal “a”): lo depositado más los días adicionales.
   *
   * Se calcula con el salario integral **histórico** de cada depósito cuando se quiere exactitud;
   * aquí se ofrece la versión con un solo salario para estimaciones y para los casos de prueba.
   */
  guaranteeAccumulated(
    integralDaily: number,
    years: number,
    quartersDeposited: number,
    settings: BenefitSettings = DEFAULT_BENEFIT_SETTINGS
  ): number {
    const days =
      quartersDeposited * settings.DIAS_GARANTIA_TRIMESTRE +
      this.additionalBenefitDays(years, settings);

    return Number(this.money.round(integralDaily * days));
  }

  /**
   * Modalidad retroactiva (Art. 142 literal “b”): días por año al **último** salario integral.
   * ⚠️ Los días por año son un parámetro a validar (P-28).
   */
  retroactiveAmount(
    integralDailyAtTermination: number,
    years: number,
    settings: BenefitSettings = DEFAULT_BENEFIT_SETTINGS
  ): number {
    return Number(
      this.money.round(integralDailyAtTermination * years * settings.DIAS_RETROACTIVO_ANIO)
    );
  }

  /**
   * Compara las dos modalidades y devuelve la mayor (RN-11).
   * Se reciben ya calculadas porque la garantía usa salarios históricos y el retroactivo el último.
   */
  compareModalities(guaranteeAccumulated: number, retroactive: number): BenefitsModality {
    const modality = retroactive > guaranteeAccumulated ? 'RETROACTIVE' : 'GUARANTEE';

    return {
      guaranteeAccumulated,
      retroactive,
      payable: modality === 'RETROACTIVE' ? retroactive : guaranteeAccumulated,
      modality,
    };
  }

  /**
   * Días de utilidades del ejercicio (Art. 131, RN-16).
   * Año completo: al menos `DIAS_UTILIDADES`. Año parcial: proporcional a los meses trabajados.
   */
  profitSharingDays(
    monthsWorked: number,
    settings: BenefitSettings = DEFAULT_BENEFIT_SETTINGS
  ): number {
    if (monthsWorked <= 0) return 0;

    const capped = Math.min(monthsWorked, 12);
    const proportional = (settings.DIAS_UTILIDADES * capped) / 12;
    const ceiling = settings.TOPE_UTILIDADES_MESES * 30;
    const days = Math.min(Math.round(proportional), ceiling);

    return Math.max(days, 0);
  }

  /** Utilidades en dinero: días a pagar por salario diario promedio. */
  profitSharing(
    salaryDaily: number,
    monthsWorked: number,
    settings: BenefitSettings = DEFAULT_BENEFIT_SETTINGS
  ): ProfitSharing {
    const days = this.profitSharingDays(monthsWorked, settings);
    const capped = Math.min(monthsWorked, 12);

    return {
      days,
      monthsWorked: capped,
      amount: Number(this.money.round(salaryDaily * days)),
    };
  }

  /** Pago de vacaciones y bono vacacional sobre el salario normal diario (RN-14, RN-15). */
  vacationPay(
    normalDaily: number,
    years: number,
    daysToPay: number,
    settings: BenefitSettings = DEFAULT_BENEFIT_SETTINGS
  ): { vacationAmount: number; bonusAmount: number; total: number } {
    const entitlement = this.vacationEntitlement(years, settings);
    const days = Math.min(daysToPay, entitlement.vacationDays);

    if (days < 0) {
      throw new BenefitCalculationError('Los días de vacaciones a pagar no pueden ser negativos');
    }

    const vacationAmount = Number(this.money.round(normalDaily * days));
    const bonusAmount = Number(this.money.round(normalDaily * entitlement.bonusDays));

    return {
      vacationAmount,
      bonusAmount,
      total: Number(this.money.round(vacationAmount + bonusAmount)),
    };
  }
}
