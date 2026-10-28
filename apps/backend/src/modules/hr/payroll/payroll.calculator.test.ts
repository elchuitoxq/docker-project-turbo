import { describe, expect, it } from 'vitest';
import {
  ConceptDefinition,
  PayrollCalculationContext,
  PayrollCalculator,
  PayrollCalculationError,
} from './payroll.calculator';
import { PayrollConceptCategory, PayrollConceptKind } from '../dto/hr.dto';

/**
 * Casos dorados de `docs/09-HR-NOMINA-VENEZUELA.md` §9 (`T-02-03`).
 *
 * Salario mensual Bs. 10.000,00, período de 30 días, sin primas ni horas extra. Los importes
 * esperados salen de la aritmética del documento, no de ejecutar el motor y copiar el resultado.
 */

const CALCULATOR = new PayrollCalculator();

/** Catálogo equivalente al que siembra `seed-payroll-catalog.ts`. */
function catalog(): ConceptDefinition[] {
  const concept = (
    code: string,
    name: string,
    category: PayrollConceptCategory,
    expression: string | null,
    extra: Partial<ConceptDefinition> = {}
  ): ConceptDefinition => ({
    code,
    name,
    category,
    kind: expression ? PayrollConceptKind.FORMULA : PayrollConceptKind.FIXED,
    expression,
    affectsIntegralSalary: false,
    isSalarial: true,
    ...extra,
  });

  return [
    concept(
      'SALARY',
      'Sueldo del período',
      PayrollConceptCategory.ASSIGNMENT,
      'SALARY_BASE * (PERIOD_DAYS / MONTH_DAYS)',
      { affectsIntegralSalary: true }
    ),
    concept('PRIMA', 'Primas habituales', PayrollConceptCategory.ASSIGNMENT, null, {
      affectsIntegralSalary: true,
    }),
    concept('CESTATICKET', 'Cestaticket', PayrollConceptCategory.ASSIGNMENT, 'CESTATICKET_USD', {
      isSalarial: false,
    }),
    concept(
      'SSO_EMP',
      'Seguro social',
      PayrollConceptCategory.DEDUCTION,
      'BASE_IVSS * SSO_EMP / 100'
    ),
    concept(
      'PIE_EMP',
      'Paro forzoso',
      PayrollConceptCategory.DEDUCTION,
      'BASE_PARO * PIE_EMP / 100'
    ),
    concept('FAOV_EMP', 'FAOV', PayrollConceptCategory.DEDUCTION, 'BASE_FAOV * FAOV_EMP / 100'),
    concept(
      'SSO_PAT',
      'Seguro social patronal',
      PayrollConceptCategory.EMPLOYER_CONTRIBUTION,
      'BASE_IVSS * SSO_PAT / 100'
    ),
    concept(
      'PIE_PAT',
      'Paro forzoso patronal',
      PayrollConceptCategory.EMPLOYER_CONTRIBUTION,
      'BASE_PARO * PIE_PAT / 100'
    ),
    concept(
      'FAOV_PAT',
      'FAOV patronal',
      PayrollConceptCategory.EMPLOYER_CONTRIBUTION,
      'BASE_FAOV * FAOV_PAT / 100'
    ),
    concept(
      'UTIL_ALLOWANCE',
      'Alícuota de utilidades',
      PayrollConceptCategory.INFORMATIVE,
      '(DIAS_UTILIDADES * (SALARY_NORMAL / MONTH_DAYS)) / 360',
      { affectsIntegralSalary: true }
    ),
    concept(
      'BONUS_ALLOWANCE',
      'Alícuota de bono vacacional',
      PayrollConceptCategory.INFORMATIVE,
      '(DIAS_BONO_VACACIONAL * (SALARY_NORMAL / MONTH_DAYS)) / 360',
      { affectsIntegralSalary: true }
    ),
    concept(
      'BENEFIT_GUARANTEE',
      'Garantía trimestral',
      PayrollConceptCategory.INFORMATIVE,
      'SALARY_INTEGRAL * DIAS_GARANTIA_TRIMESTRE'
    ),
  ];
}

const SETTINGS = {
  SSO_EMP: 4,
  SSO_PAT: 10,
  PIE_EMP: 0.5,
  PIE_PAT: 2,
  FAOV_EMP: 1,
  FAOV_PAT: 2,
  CESTATICKET_USD: 0,
  DIAS_UTILIDADES: 30,
  DIAS_BONO_VACACIONAL: 7,
  DIAS_GARANTIA_TRIMESTRE: 15,
};

function context(overrides: Partial<PayrollCalculationContext> = {}): PayrollCalculationContext {
  return {
    periodDays: 30,
    monthDays: 30,
    settings: { ...SETTINGS },
    concepts: catalog(),
    convertToRunCurrency: (amount: number) => amount,
    runCurrency: 'VES',
    ...overrides,
  };
}

function employee(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: 'emp-1',
    baseSalary: 10_000,
    salaryCurrency: 'VES',
    ...overrides,
  };
}

function amountOf(result: ReturnType<PayrollCalculator['calculate']>, code: string): number {
  return result.lines.find(line => line.conceptCode === code)?.amount ?? Number.NaN;
}

describe('PayrollCalculator · caso dorado §9', () => {
  const result = CALCULATOR.calculate(employee(), context());

  it('prorratea el sueldo del período completo', () => {
    expect(result.baseAmount).toBe(10_000);
    expect(amountOf(result, 'SALARY')).toBe(10_000);
  });

  it('calcula las alícuotas diarias de utilidades y bono vacacional', () => {
    // La línea se redondea a 2 decimales al persistir; la precisión completa queda en las bases.
    expect(amountOf(result, 'UTIL_ALLOWANCE')).toBeCloseTo(27.78, 2);
    expect(amountOf(result, 'BONUS_ALLOWANCE')).toBeCloseTo(6.48, 2);
  });

  it('calcula el salario integral diario (RN-05)', () => {
    expect(result.variables.SALARY_NORMAL).toBeCloseTo(10_000, 2);
    expect(result.variables.SALARY_INTEGRAL).toBeCloseTo(367.592593, 6);
  });

  it('calcula la garantía trimestral sobre el integral diario sin redondeo intermedio', () => {
    expect(amountOf(result, 'BENEFIT_GUARANTEE')).toBeCloseTo(5_513.89, 2);
  });

  it('aplica las deducciones legales sobre el salario normal', () => {
    expect(amountOf(result, 'SSO_EMP')).toBeCloseTo(400, 2);
    expect(amountOf(result, 'PIE_EMP')).toBeCloseTo(50, 2);
    expect(amountOf(result, 'FAOV_EMP')).toBeCloseTo(100, 2);
    expect(result.deductions).toBeCloseTo(550, 2);
  });

  it('registra el costo patronal sin restarlo del neto (RN-08, H-63)', () => {
    expect(amountOf(result, 'SSO_PAT')).toBeCloseTo(1_000, 2);
    expect(amountOf(result, 'PIE_PAT')).toBeCloseTo(200, 2);
    expect(amountOf(result, 'FAOV_PAT')).toBeCloseTo(200, 2);
    expect(result.employerContributions).toBeCloseTo(1_400, 2);
    expect(result.netTotal).toBeCloseTo(9_450, 2);
  });

  it('no incluye conceptos informativos en el neto', () => {
    const informative = result.lines.filter(
      line => line.category === PayrollConceptCategory.INFORMATIVE
    );
    expect(informative.length).toBeGreaterThan(0);
    expect(result.netTotal).toBeCloseTo(10_000 - 550, 2);
  });
});

describe('PayrollCalculator · reglas de negocio', () => {
  it('prorratea por días del período (RN-01)', () => {
    const result = CALCULATOR.calculate(employee(), context({ periodDays: 15 }));

    expect(result.baseAmount).toBe(5_000);
    expect(amountOf(result, 'SSO_EMP')).toBeCloseTo(200, 2);
    expect(result.netTotal).toBeCloseTo(4_725, 2);
  });

  it('no paga más de un mes completo aunque el período tenga 31 días', () => {
    const result = CALCULATOR.calculate(employee(), context({ periodDays: 31 }));
    expect(result.baseAmount).toBe(10_000);
  });

  it('el cestaticket no entra en el salario normal ni en el integral (RN-02, RN-17)', () => {
    const withCestaticket = CALCULATOR.calculate(
      employee(),
      context({ settings: { ...SETTINGS, CESTATICKET_USD: 1_000 } })
    );

    expect(amountOf(withCestaticket, 'CESTATICKET')).toBe(1_000);
    expect(withCestaticket.variables.SALARY_NORMAL).toBeCloseTo(10_000, 2);
    expect(withCestaticket.variables.SALARY_INTEGRAL).toBeCloseTo(367.592593, 6);
    expect(withCestaticket.netTotal).toBeCloseTo(10_450, 2);
  });

  it('aplica el tope de la base antes de la alícuota (RN-06)', () => {
    const result = CALCULATOR.calculate(
      employee(),
      context({ settings: { ...SETTINGS, TOPE_SSO: 5_000 } })
    );

    expect(result.variables.BASE_IVSS).toBe(5_000);
    expect(amountOf(result, 'SSO_EMP')).toBeCloseTo(200, 2);
    expect(amountOf(result, 'PIE_EMP')).toBeCloseTo(50, 2);
  });

  it('convierte el sueldo de la moneda del contrato a la del run (M4, H-62)', () => {
    const result = CALCULATOR.calculate(employee({ baseSalary: 100, salaryCurrency: 'USD' }), {
      ...context(),
      runCurrency: 'VES',
      convertToRunCurrency: (amount: number, from: string) =>
        from === 'USD' ? amount * 36.5 : amount,
    });

    expect(result.baseAmount).toBeCloseTo(3_650, 2);
    expect(amountOf(result, 'SSO_EMP')).toBeCloseTo(146, 2);
  });

  it('convierte un parámetro en divisa antes de usarlo', () => {
    // El servicio ya entrega el parámetro convertido; aquí se comprueba el efecto en el cálculo.
    const result = CALCULATOR.calculate(
      employee(),
      context({ settings: { ...SETTINGS, CESTATICKET_USD: 40 * 36.5 } })
    );

    expect(amountOf(result, 'CESTATICKET')).toBeCloseTo(1_460, 2);
  });

  it('falla si el neto resulta negativo (RN-10)', () => {
    const expensiveDeduction: ConceptDefinition = {
      code: 'PRESTAMO',
      name: 'Préstamo',
      category: PayrollConceptCategory.DEDUCTION,
      kind: PayrollConceptKind.FORMULA,
      expression: 'SALARY_NORMAL * 3',
      affectsIntegralSalary: false,
      isSalarial: true,
    };

    expect(() =>
      CALCULATOR.calculate(employee(), context({ concepts: [...catalog(), expensiveDeduction] }))
    ).toThrow(PayrollCalculationError);
  });

  it('falla si no hay conceptos configurados', () => {
    expect(() => CALCULATOR.calculate(employee(), context({ concepts: [] }))).toThrow(
      PayrollCalculationError
    );
  });

  it('falla con un mensaje claro si la fórmula usa un parámetro que ya no existe', () => {
    // Caso real: el concepto se creó cuando existía el parámetro y después se eliminó.
    const orphan: ConceptDefinition = {
      code: 'SSO_HUERFANO',
      name: 'Concepto con parámetro borrado',
      category: PayrollConceptCategory.DEDUCTION,
      kind: PayrollConceptKind.FORMULA,
      expression: 'BASE_IVSS * SSO_EMP_BORRADO / 100',
      affectsIntegralSalary: false,
      isSalarial: true,
    };

    expect(() => CALCULATOR.calculate(employee(), context({ concepts: [orphan] }))).toThrow(
      /SSO_EMP_BORRADO/
    );
  });

  it('falla si una fórmula divide por cero', () => {
    const divideByZero: ConceptDefinition = {
      code: 'CERO',
      name: 'División por cero',
      category: PayrollConceptCategory.DEDUCTION,
      kind: PayrollConceptKind.FORMULA,
      expression: 'SALARY_NORMAL / 0',
      affectsIntegralSalary: false,
      isSalarial: true,
    };

    expect(() =>
      CALCULATOR.calculate(employee(), context({ concepts: [...catalog(), divideByZero] }))
    ).toThrow(/División por cero/);
  });

  it('falla con días de período fuera de rango', () => {
    expect(() => CALCULATOR.calculate(employee(), context({ periodDays: 0 }))).toThrow(
      PayrollCalculationError
    );
  });

  it('expone base y tasa efectiva en cada línea para poder explicar el recibo', () => {
    const sso = result_line('SSO_EMP');
    expect(sso.base).toBeCloseTo(10_000, 2);
    expect(sso.rate).toBeCloseTo(0.04, 6);
  });
});

function result_line(code: string) {
  const result = CALCULATOR.calculate(employee(), context());
  const line = result.lines.find(item => item.conceptCode === code);
  if (!line) throw new Error(`Línea ${code} no encontrada`);
  return line;
}

/**
 * Desgravámenes de ISLR (`P-30`).
 *
 * La retención no se calcula sobre el salario normal completo: los aportes obligatorios del
 * trabajador restan de la base antes de aplicar la tarifa del Art. 50. El motor no cablea los
 * códigos: resta lo que el concepto declare con `reducesIncomeTaxBase`.
 */
describe('PayrollCalculator · desgravámenes de ISLR (P-30)', () => {
  const ISLR_CONCEPT: ConceptDefinition = {
    code: 'ISLR',
    name: 'Retención de ISLR',
    category: PayrollConceptCategory.DEDUCTION,
    kind: PayrollConceptKind.FORMULA,
    expression: 'ISLR_WITHHOLDING',
    affectsIntegralSalary: false,
    isSalarial: true,
  };

  /** Marca como desgravables los códigos indicados y devuelve el catálogo con el concepto ISLR. */
  function catalogWith(codes: string[], extra: ConceptDefinition[] = []): ConceptDefinition[] {
    return [
      ...catalog().map(concept => ({
        ...concept,
        reducesIncomeTaxBase: codes.includes(concept.code),
      })),
      ...extra,
      ISLR_CONCEPT,
    ];
  }

  /** Calcula y devuelve la base anual que recibió el calculador de ISLR. */
  function calculateCapturingBase(concepts: ConceptDefinition[], withholding = 100) {
    let seenAnnualBase = Number.NaN;
    const result = CALCULATOR.calculate(employee(), {
      ...context(),
      concepts,
      computeIncomeTax: (annualBase: number) => {
        seenAnnualBase = annualBase;
        return withholding;
      },
    });

    return { result, seenAnnualBase };
  }

  it('resta los aportes del trabajador de la base antes de aplicar la tarifa', () => {
    const { result, seenAnnualBase } = calculateCapturingBase(
      catalogWith(['SSO_EMP', 'PIE_EMP', 'FAOV_EMP'])
    );

    // 10.000 − (400 + 50 + 100) = 9.450 de base mensual → 113.400 anuales.
    expect(result.variables.BASE_ISLR).toBeCloseTo(9_450, 2);
    expect(seenAnnualBase).toBeCloseTo(113_400, 2);
  });

  it('descuenta la retención del neto y la muestra como línea propia', () => {
    const { result } = calculateCapturingBase(catalogWith(['SSO_EMP', 'PIE_EMP', 'FAOV_EMP']));

    expect(amountOf(result, 'ISLR')).toBe(100);
    expect(result.deductions).toBeCloseTo(650, 2);
    expect(result.netTotal).toBeCloseTo(9_350, 2);
  });

  it('la línea de retención expone la base gravable, no el importe retenido', () => {
    const { result } = calculateCapturingBase(catalogWith(['SSO_EMP', 'PIE_EMP', 'FAOV_EMP']));
    const line = result.lines.find(item => item.conceptCode === 'ISLR');

    expect(line?.base).toBeCloseTo(9_450, 2);
    expect(line?.amount).toBe(100);
  });

  it('sin conceptos marcados la base sigue siendo el salario normal (retrocompatible)', () => {
    const { result, seenAnnualBase } = calculateCapturingBase(catalogWith([]));

    expect(result.variables.BASE_ISLR).toBeCloseTo(10_000, 2);
    expect(seenAnnualBase).toBeCloseTo(120_000, 2);
  });

  it('sólo restan las deducciones: marcar una asignación no cambia la base', () => {
    const { seenAnnualBase } = calculateCapturingBase(
      catalogWith(['PRIMA', 'CESTATICKET', 'SALARY'])
    );

    expect(seenAnnualBase).toBeCloseTo(120_000, 2);
  });

  it('la base nunca queda negativa aunque los desgravámenes superen el sueldo', () => {
    const bigDeduction: ConceptDefinition = {
      code: 'ADELANTO',
      name: 'Adelanto de sueldo',
      category: PayrollConceptCategory.DEDUCTION,
      kind: PayrollConceptKind.FORMULA,
      expression: 'SALARY_NORMAL',
      affectsIntegralSalary: false,
      isSalarial: true,
      reducesIncomeTaxBase: true,
    };

    let seenAnnualBase = Number.NaN;
    const result = CALCULATOR.calculate(employee(), {
      // Sin aportes para que el neto no quede negativo: aquí se prueba el tope de la base, no RN-10.
      ...context({ settings: { ...SETTINGS, SSO_EMP: 0, PIE_EMP: 0, FAOV_EMP: 0 } }),
      concepts: catalogWith([], [bigDeduction]),
      computeIncomeTax: (annualBase: number) => {
        seenAnnualBase = annualBase;
        return 0;
      },
    });

    expect(result.variables.BASE_ISLR).toBe(0);
    expect(seenAnnualBase).toBe(0);
  });

  it('respeta el tope del aporte: se desgrava lo descontado, no el porcentaje teórico', () => {
    // Con tope de 5.000 el seguro social descontado es 200, así que la base baja en 200 y no en 400.
    let seenAnnualBase = Number.NaN;
    const result = CALCULATOR.calculate(employee(), {
      ...context({ settings: { ...SETTINGS, TOPE_SSO: 5_000 } }),
      concepts: catalogWith(['SSO_EMP', 'PIE_EMP', 'FAOV_EMP']),
      computeIncomeTax: (annualBase: number) => {
        seenAnnualBase = annualBase;
        return 100;
      },
    });

    expect(result.variables.BASE_ISLR).toBeCloseTo(9_650, 2);
    expect(seenAnnualBase).toBeCloseTo(115_800, 2);
  });
});
