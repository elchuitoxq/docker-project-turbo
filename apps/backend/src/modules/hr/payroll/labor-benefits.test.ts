import { describe, expect, it } from 'vitest';
import {
  BenefitCalculationError,
  DEFAULT_BENEFIT_SETTINGS,
  LaborBenefits,
  SettlementCause,
} from './labor-benefits';

/**
 * Prestaciones, vacaciones y utilidades (`T-02-04`).
 * Los importes esperados salen de la aritmética de `docs/09-HR-NOMINA-VENEZUELA.md` §9.
 */

const BENEFITS = new LaborBenefits();
const SETTINGS = DEFAULT_BENEFIT_SETTINGS;

/** Salario integral diario del caso dorado (10.000 mensuales). */
const INTEGRAL_DAILY = 367.592593;

describe('LaborBenefits · antigüedad', () => {
  it('cuenta años cumplidos, no años calendario', () => {
    expect(BENEFITS.serviceYears(new Date('2024-01-15'), new Date('2026-10-27'))).toBe(2);
    expect(BENEFITS.serviceYears(new Date('2024-01-15'), new Date('2026-01-14'))).toBe(1);
    expect(BENEFITS.serviceYears(new Date('2024-01-15'), new Date('2026-01-15'))).toBe(2);
  });

  it('no cuenta años negativos si la fecha es anterior al ingreso', () => {
    expect(BENEFITS.serviceYears(new Date('2026-01-15'), new Date('2025-01-15'))).toBe(0);
  });
});

describe('LaborBenefits · vacaciones y bono (RN-14, RN-15)', () => {
  it('al primer año paga los días base', () => {
    expect(BENEFITS.vacationEntitlement(1, SETTINGS)).toEqual({
      years: 1,
      vacationDays: 15,
      bonusDays: 7,
    });
  });

  it('suma un día por año desde el segundo', () => {
    expect(BENEFITS.vacationEntitlement(3, SETTINGS).vacationDays).toBe(17);
    expect(BENEFITS.vacationEntitlement(3, SETTINGS).bonusDays).toBe(9);
  });

  it('respeta el tope de días adicionales', () => {
    expect(BENEFITS.vacationEntitlement(30, SETTINGS).vacationDays).toBe(30);
    expect(BENEFITS.vacationEntitlement(30, SETTINGS).bonusDays).toBe(28);
  });

  it('paga vacaciones y bono sobre el salario normal diario', () => {
    const pay = BENEFITS.vacationPay(333.333333, 3, 17, SETTINGS);

    expect(pay.vacationAmount).toBeCloseTo(5_666.67, 2);
    expect(pay.bonusAmount).toBeCloseTo(3_000, 2);
    expect(pay.total).toBeCloseTo(8_666.67, 2);
  });

  it('no paga más días de los que corresponden', () => {
    const pay = BENEFITS.vacationPay(333.333333, 1, 40, SETTINGS);
    expect(pay.vacationAmount).toBeCloseTo(5_000, 2);
  });
});

describe('LaborBenefits · prestaciones (RN-11, RN-12, RN-13)', () => {
  it('acumula dos días por año desde el segundo, con tope', () => {
    expect(BENEFITS.additionalBenefitDays(1, SETTINGS)).toBe(0);
    expect(BENEFITS.additionalBenefitDays(5, SETTINGS)).toBe(8);
    expect(BENEFITS.additionalBenefitDays(20, SETTINGS)).toBe(30);
  });

  it('deposita 15 días por trimestre', () => {
    const deposit = BENEFITS.quarterlyDeposit(INTEGRAL_DAILY, 1, false, SETTINGS);

    expect(deposit.days).toBe(15);
    expect(deposit.additionalDays).toBe(0);
    expect(deposit.amount).toBeCloseTo(5_513.89, 2);
  });

  it('suma los días adicionales en el trimestre del aniversario', () => {
    const deposit = BENEFITS.quarterlyDeposit(INTEGRAL_DAILY, 3, true, SETTINGS);

    expect(deposit.additionalDays).toBe(4);
    expect(deposit.days).toBe(19);
    expect(deposit.amount).toBeCloseTo(6_984.26, 2);
  });

  it('acumula la garantía con los días adicionales', () => {
    // 5 años, 20 trimestres: 300 días + 8 adicionales = 308 días.
    expect(BENEFITS.guaranteeAccumulated(INTEGRAL_DAILY, 5, 20, SETTINGS)).toBeCloseTo(
      113_218.52,
      2
    );
  });

  it('calcula el retroactivo sobre el último salario integral', () => {
    expect(BENEFITS.retroactiveAmount(INTEGRAL_DAILY, 5, SETTINGS)).toBeCloseTo(55_138.89, 2);
  });

  it('paga la modalidad mayor', () => {
    const mayor = BENEFITS.compareModalities(113_218.52, 55_138.89);
    expect(mayor.modality).toBe('GUARANTEE');
    expect(mayor.payable).toBe(113_218.52);

    const conAumento = BENEFITS.compareModalities(10_000, 55_138.89);
    expect(conAumento.modality).toBe('RETROACTIVE');
    expect(conAumento.payable).toBe(55_138.89);
  });

  it('rechaza un salario integral negativo', () => {
    expect(() => BENEFITS.quarterlyDeposit(-1, 1, false, SETTINGS)).toThrow(
      BenefitCalculationError
    );
  });
});

describe('LaborBenefits · indemnización por egreso (Art. 92)', () => {
  it('cuenta meses completos entre dos fechas', () => {
    expect(BENEFITS.monthsBetween(new Date('2026-01-15'), new Date('2026-10-31'))).toBe(9);
    expect(BENEFITS.monthsBetween(new Date('2026-01-15'), new Date('2026-10-14'))).toBe(8);
    expect(BENEFITS.monthsBetween(new Date('2026-01-15'), new Date('2026-01-15'))).toBe(0);
    expect(BENEFITS.monthsBetween(new Date('2026-05-01'), new Date('2026-01-01'))).toBe(0);
  });

  it('sólo indemniza el despido injustificado', () => {
    for (const cause of [
      SettlementCause.RENUNCIA,
      SettlementCause.DESPIDO_JUSTIFICADO,
      SettlementCause.MUTUO_ACUERDO,
      SettlementCause.JUBILACION,
      SettlementCause.MUERTE,
      SettlementCause.INCAPACIDAD,
    ]) {
      expect(BENEFITS.indemnificationDays(5, 3, cause, SETTINGS)).toBe(0);
    }
  });

  it('paga 30 días hasta el primer año', () => {
    expect(
      BENEFITS.indemnificationDays(0, 6, SettlementCause.DESPIDO_INJUSTIFICADO, SETTINGS)
    ).toBe(30);
    expect(
      BENEFITS.indemnificationDays(1, 0, SettlementCause.DESPIDO_INJUSTIFICADO, SETTINGS)
    ).toBe(30);
  });

  it('cuenta la fracción mayor a seis meses como año completo', () => {
    expect(
      BENEFITS.indemnificationDays(2, 6, SettlementCause.DESPIDO_INJUSTIFICADO, SETTINGS)
    ).toBe(60);
    expect(
      BENEFITS.indemnificationDays(2, 7, SettlementCause.DESPIDO_INJUSTIFICADO, SETTINGS)
    ).toBe(90);
  });

  it('respeta el tope de 150 días hasta los diez años', () => {
    expect(
      BENEFITS.indemnificationDays(4, 9, SettlementCause.DESPIDO_INJUSTIFICADO, SETTINGS)
    ).toBe(150);
    expect(
      BENEFITS.indemnificationDays(10, 0, SettlementCause.DESPIDO_INJUSTIFICADO, SETTINGS)
    ).toBe(150);
  });

  it('pasa a 60 días por año y tope de 300 después de diez años', () => {
    expect(
      BENEFITS.indemnificationDays(11, 0, SettlementCause.DESPIDO_INJUSTIFICADO, SETTINGS)
    ).toBe(300);
    expect(
      BENEFITS.indemnificationDays(20, 0, SettlementCause.DESPIDO_INJUSTIFICADO, SETTINGS)
    ).toBe(300);
  });
});

describe('LaborBenefits · utilidades (RN-16)', () => {
  it('paga los días mínimos con el año completo', () => {
    const sharing = BENEFITS.profitSharing(333.333333, 12, SETTINGS);

    expect(sharing.days).toBe(30);
    expect(sharing.amount).toBeCloseTo(10_000, 2);
  });

  it('paga proporcional con fracción de año', () => {
    const sharing = BENEFITS.profitSharing(333.333333, 6, SETTINGS);

    expect(sharing.days).toBe(15);
    expect(sharing.amount).toBeCloseTo(5_000, 2);
  });

  it('no paga nada sin meses trabajados', () => {
    expect(BENEFITS.profitSharingDays(0, SETTINGS)).toBe(0);
  });

  it('respeta el tope de meses configurado', () => {
    const sharing = BENEFITS.profitSharingDays(12, {
      ...SETTINGS,
      DIAS_UTILIDADES: 120,
      TOPE_UTILIDADES_MESES: 4,
    });

    expect(sharing).toBe(120);
  });
});
