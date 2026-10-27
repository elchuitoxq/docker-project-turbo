import { MoneyService } from '../../../common/money/money.service';
import { PayrollConceptCategory, PayrollConceptKind } from '../dto/hr.dto';
import { CONCEPT_BASES, DERIVED_FROM_NORMAL, extractIdentifiers } from './concept-expression';
import {
  ExpressionEvaluationError,
  MissingVariableError,
  evaluateExpression,
} from './expression-evaluator';

/**
 * Motor de cálculo de nómina (`T-02-03`).
 *
 * Implementa el pipeline de `docs/09-HR-NOMINA-VENEZUELA.md` §6 sobre el catálogo de conceptos de
 * la empresa: cada concepto aporta su fórmula (`expression`) y el motor la resuelve en el orden en
 * que las bases se van necesitando. No hay constantes legales en el código: las alícuotas y los
 * topes vienen de `payroll_settings`.
 *
 * Todo el dinero pasa por `MoneyService` (regla M4 de `S-08`): se calcula con precisión completa y
 * se redondea sólo al persistir.
 */

export interface ConceptDefinition {
  code: string;
  name: string;
  category: PayrollConceptCategory;
  kind: PayrollConceptKind;
  expression: string | null;
  affectsIntegralSalary: boolean;
  isSalarial: boolean;
}

export interface PayrollEmployeeInput {
  employeeId: string;
  /** Sueldo mensual en la moneda del contrato. */
  baseSalary: number;
  /** Código de la moneda del contrato (`employees.salaryCurrencyId`). */
  salaryCurrency: string;
  hours?: number;
  hourRate?: number;
  units?: number;
  baseAmount?: number;
  baseAmountCurrency?: string;
}

export interface PayrollCalculationContext {
  /** Días del período que se paga (prorrateo). */
  periodDays: number;
  /** Días de referencia del mes; 30 por convención LOTTT. */
  monthDays?: number;
  /** Parámetros vigentes, ya convertidos a la moneda del run. */
  settings: Record<string, number>;
  concepts: ConceptDefinition[];
  /** Convierte un monto a la moneda del run con la tasa del período. */
  convertToRunCurrency: (amount: number, fromCurrency: string) => number;
  /** Código de la moneda del run, para convertir el sueldo del contrato. */
  runCurrency: string;
}

export interface PayrollLine {
  conceptCode: string;
  conceptName: string;
  category: PayrollConceptCategory;
  base: number;
  rate: number;
  amount: number;
}

export interface PayrollItemCalculation {
  baseAmount: number;
  bonuses: number;
  deductions: number;
  employerContributions: number;
  netTotal: number;
  lines: PayrollLine[];
  /** Bases calculadas del período; se usan en las pruebas y en la auditoría del recibo. */
  variables: Record<string, number>;
}

export class PayrollCalculationError extends Error {}

const CATEGORY_ORDER: Record<PayrollConceptCategory, number> = {
  [PayrollConceptCategory.ASSIGNMENT]: 0,
  [PayrollConceptCategory.DEDUCTION]: 1,
  [PayrollConceptCategory.EMPLOYER_CONTRIBUTION]: 2,
  [PayrollConceptCategory.INFORMATIVE]: 3,
};

const SETTING_BASES: Array<{ variable: string; topeKey: string }> = [
  { variable: 'BASE_IVSS', topeKey: 'TOPE_SSO' },
  { variable: 'BASE_PARO', topeKey: 'TOPE_PARO' },
  { variable: 'BASE_FAOV', topeKey: 'TOPE_FAOV' },
];

export class PayrollCalculator {
  /** Concepto del sistema que representa el sueldo del período. */
  static readonly SALARY_CONCEPT_CODE = 'SALARY';

  constructor(private readonly money: MoneyService = new MoneyService()) {}

  calculate(
    employee: PayrollEmployeeInput,
    context: PayrollCalculationContext
  ): PayrollItemCalculation {
    const monthDays = context.monthDays ?? 30;
    if (context.periodDays <= 0 || context.periodDays > 31) {
      throw new PayrollCalculationError(
        `Días del período inválidos: ${context.periodDays}. Debe estar entre 1 y 31.`
      );
    }

    if (context.concepts.length === 0) {
      throw new PayrollCalculationError(
        'No hay conceptos de nómina configurados para la empresa. Cárguelos antes de generar la nómina.'
      );
    }

    // Un período nunca paga más de un mes de sueldo: 31 días se tratan como 30 (convención LOTTT).
    const effectiveDays = Math.min(context.periodDays, monthDays);
    const variables = this.buildBaseVariables(employee, context, monthDays, effectiveDays);
    const amounts = new Map<string, number>();

    // Pasada 1: conceptos que sólo dependen de datos del empleado y de parámetros.
    const phaseOne = context.concepts.filter(
      concept => !this.usesAny(concept, [...DERIVED_FROM_NORMAL, 'SALARY_INTEGRAL'])
    );
    this.resolvePhase('inicial', phaseOne, variables, amounts);

    variables.SALARY_NORMAL = this.sumAssignments(phaseOne, amounts);
    for (const { variable, topeKey } of SETTING_BASES) {
      variables[variable] = this.cap(variables.SALARY_NORMAL, context.settings[topeKey]);
    }
    variables.BASE_ISLR = variables.SALARY_NORMAL;

    // Pasada 2: deducciones, aportes y alícuotas sobre el salario normal.
    const phaseTwo = context.concepts.filter(
      concept =>
        !this.usesAny(concept, ['SALARY_INTEGRAL']) && this.usesAny(concept, DERIVED_FROM_NORMAL)
    );
    this.resolvePhase('salario normal', phaseTwo, variables, amounts);

    // El salario integral se expresa en valor diario, igual que las alícuotas (§9):
    // SALARY_INTEGRAL = SALARY_NORMAL / MONTH_DAYS + alícuota utilidades + alícuota bono vacacional.
    // Sólo suman las alícuotas informativas marcadas como parte del integral (LOTTT Art. 105).
    const dailyNormal = variables.SALARY_NORMAL / monthDays;
    const allowances = phaseTwo
      .filter(
        concept =>
          concept.category === PayrollConceptCategory.INFORMATIVE && concept.affectsIntegralSalary
      )
      .reduce((acc, concept) => acc + (amounts.get(concept.code) ?? 0), 0);
    variables.SALARY_INTEGRAL = Number(this.money.round(dailyNormal + allowances, 6));

    // Pasada 3: conceptos que necesitan el salario integral (prestaciones, indemnizaciones).
    const phaseThree = context.concepts.filter(concept =>
      this.usesAny(concept, ['SALARY_INTEGRAL'])
    );
    this.resolvePhase('salario integral', phaseThree, variables, amounts);

    const lines = this.buildLines([...phaseOne, ...phaseTwo, ...phaseThree], amounts, variables);
    return this.summarize(employee, amounts, lines, variables);
  }

  private buildBaseVariables(
    employee: PayrollEmployeeInput,
    context: PayrollCalculationContext,
    monthDays: number,
    periodDays: number
  ): Record<string, number> {
    const salaryInRunCurrency = context.convertToRunCurrency(
      employee.baseSalary,
      employee.salaryCurrency
    );
    const baseAmountCurrency = employee.baseAmountCurrency ?? employee.salaryCurrency;

    // Los parámetros se aplican primero y luego las bases reservadas, para que una clave de
    // parámetro no pueda sobrescribir SALARY_BASE o SALARY_NORMAL.
    const variables: Record<string, number> = { ...context.settings };

    for (const reserved of CONCEPT_BASES) {
      variables[reserved] = 0;
    }

    variables.MONTH_DAYS = monthDays;
    variables.PERIOD_DAYS = periodDays;
    // SALARY_BASE es el sueldo **mensual**; el prorrateo lo hace la fórmula del concepto SALARY.
    variables.SALARY_BASE = salaryInRunCurrency;
    variables.HOURS = employee.hours ?? 0;
    variables.HOUR_RATE = employee.hourRate ?? 0;
    variables.UNITS = employee.units ?? 0;
    variables.BASE_AMOUNT = employee.baseAmount
      ? context.convertToRunCurrency(employee.baseAmount, baseAmountCurrency)
      : 0;

    return variables;
  }

  private usesAny(concept: ConceptDefinition, identifiers: readonly string[]): boolean {
    if (!concept.expression) return false;

    const used = extractIdentifiers(concept.expression);
    return identifiers.some(identifier => used.includes(identifier));
  }

  private resolvePhase(
    phase: string,
    concepts: ConceptDefinition[],
    variables: Record<string, number>,
    amounts: Map<string, number>
  ): void {
    for (const concept of concepts) {
      const amount = this.evaluate(concept, variables, phase);
      amounts.set(concept.code, amount);
    }
  }

  private evaluate(
    concept: ConceptDefinition,
    variables: Record<string, number>,
    phase: string
  ): number {
    if (concept.expression) {
      try {
        return evaluateExpression(concept.expression, variables);
      } catch (error) {
        if (error instanceof MissingVariableError) {
          throw new PayrollCalculationError(
            `El concepto ${concept.code} usa "${error.variable}", que no está disponible en la pasada ${phase}. Revise el orden o la fórmula.`
          );
        }
        if (error instanceof ExpressionEvaluationError) {
          throw new PayrollCalculationError(
            `El concepto ${concept.code} tiene una fórmula inválida: ${error.message}`
          );
        }
        throw error;
      }
    }

    if (concept.kind === PayrollConceptKind.FORMULA) {
      throw new PayrollCalculationError(
        `El concepto ${concept.code} es de tipo FORMULA y no tiene expresión`
      );
    }

    // Los conceptos sin fórmula (monto fijo, porcentaje manual, base) no aportan monto propio:
    // su importe se carga por incidencia o por novedad, no los inventa el motor.
    return 0;
  }

  private sumAssignments(
    concepts: ConceptDefinition[],
    amounts: Map<string, number>,
    initial = 0,
    predicate: (concept: ConceptDefinition) => boolean = concept =>
      concept.category === PayrollConceptCategory.ASSIGNMENT && concept.isSalarial
  ): number {
    const total = concepts
      .filter(predicate)
      .reduce((acc, concept) => acc + (amounts.get(concept.code) ?? 0), initial);

    return Number(this.money.round(total, 6));
  }

  private cap(value: number, tope?: number): number {
    if (tope === undefined || tope <= 0) return value;
    return Math.min(value, tope);
  }

  private buildLines(
    concepts: ConceptDefinition[],
    amounts: Map<string, number>,
    variables: Record<string, number>
  ): PayrollLine[] {
    return concepts
      .map(concept => {
        const amount = amounts.get(concept.code) ?? 0;
        const base = this.primaryBase(concept, variables, amount);

        return {
          conceptCode: concept.code,
          conceptName: concept.name,
          category: concept.category,
          base: Number(this.money.round(base, 6)),
          rate: base > 0 ? Number(this.money.round(amount / base, 6)) : 0,
          amount: Number(this.money.round(amount)),
        };
      })
      .sort(
        (a, b) =>
          CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
          a.conceptCode.localeCompare(b.conceptCode)
      );
  }

  /** Base sobre la que se aplica el concepto; sirve para explicar el recibo. */
  private primaryBase(
    concept: ConceptDefinition,
    variables: Record<string, number>,
    amount: number
  ): number {
    if (!concept.expression) return amount;

    const identifiers = extractIdentifiers(concept.expression);
    const basesUsed = CONCEPT_BASES.filter(base => identifiers.includes(base));

    if (basesUsed.includes('SALARY_INTEGRAL')) return variables.SALARY_INTEGRAL;
    if (basesUsed.includes('SALARY_NORMAL')) return variables.SALARY_NORMAL;
    if (basesUsed.includes('BASE_IVSS')) return variables.BASE_IVSS;
    if (basesUsed.includes('BASE_PARO')) return variables.BASE_PARO;
    if (basesUsed.includes('BASE_FAOV')) return variables.BASE_FAOV;
    if (basesUsed.includes('BASE_ISLR')) return variables.BASE_ISLR;
    if (basesUsed.includes('SALARY_BASE')) return variables.SALARY_BASE;

    return amount;
  }

  private summarize(
    employee: PayrollEmployeeInput,
    amounts: Map<string, number>,
    lines: PayrollLine[],
    variables: Record<string, number>
  ): PayrollItemCalculation {
    const total = (category: PayrollConceptCategory): number =>
      Number(
        this.money.sum(lines.filter(line => line.category === category).map(line => line.amount))
      );

    const assignments = total(PayrollConceptCategory.ASSIGNMENT);
    const deductions = total(PayrollConceptCategory.DEDUCTION);
    const employerContributions = total(PayrollConceptCategory.EMPLOYER_CONTRIBUTION);

    // El sueldo del período es la línea del concepto SALARY (ya prorrateada).
    const salaryBase = Number(
      this.money.round(amounts.get(PayrollCalculator.SALARY_CONCEPT_CODE) ?? variables.SALARY_BASE)
    );

    const netTotal = Number(this.money.round(assignments - deductions));
    if (netTotal < 0) {
      throw new PayrollCalculationError(
        `El neto del empleado ${employee.employeeId} resulta negativo (${netTotal}); revise las deducciones`
      );
    }

    return {
      baseAmount: salaryBase,
      bonuses: Number(this.money.round(assignments - salaryBase)),
      deductions,
      employerContributions,
      netTotal,
      lines,
      variables,
    };
  }
}
