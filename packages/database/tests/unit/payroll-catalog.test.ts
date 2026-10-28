import { describe, expect, it } from 'vitest';
import { CONCEPT_SEED, SETTING_SEED } from '../../src/scripts/seed-payroll-catalog';

/**
 * Invariantes del catálogo de nómina (`T-02-02` / `T-02-03`).
 *
 * Estas pruebas no tocan base de datos: protegen la forma del catálogo que el motor va a ejecutar.
 * La primera invariante existe porque un concepto de asignación con una fórmula que sólo depende del
 * salario normal **se paga solo todos los meses** y duplica la nómina (pasó con `VACATION_PAY`).
 */

/** Variables que hacen que una asignación dependa de un hecho del período y no sólo del sueldo. */
const INPUT_VARIABLES = ['PERIOD_DAYS', 'HOURS', 'UNITS', 'BASE_AMOUNT'];

const ALLOWED_IDENTIFIERS = new Set([
  'SALARY_BASE',
  'SALARY_NORMAL',
  'SALARY_INTEGRAL',
  'BASE_IVSS',
  'BASE_PARO',
  'BASE_FAOV',
  'BASE_ISLR',
  'ISLR_WITHHOLDING',
  'PERIOD_DAYS',
  'MONTH_DAYS',
  'HOURS',
  'HOUR_RATE',
  'UNITS',
  'BASE_AMOUNT',
  ...SETTING_SEED.map(setting => setting.key),
]);

function identifiersOf(expression: string): string[] {
  return expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
}

describe('catálogo de conceptos de nómina', () => {
  it('no repite códigos', () => {
    const codes = CONCEPT_SEED.map(concept => concept.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('toda asignación con fórmula depende de un hecho del período, no sólo del sueldo', () => {
    const offenders = CONCEPT_SEED.filter(
      concept =>
        concept.category === 'ASSIGNMENT' &&
        concept.expression !== undefined &&
        !INPUT_VARIABLES.some(variable =>
          identifiersOf(concept.expression ?? '').includes(variable)
        )
    ).map(concept => concept.code);

    expect(offenders).toEqual([]);
  });

  it('ninguna fórmula usa identificadores fuera del contrato del motor', () => {
    const unknown = new Map<string, string[]>();

    for (const concept of CONCEPT_SEED) {
      if (!concept.expression) continue;
      const invalid = identifiersOf(concept.expression).filter(
        identifier => !ALLOWED_IDENTIFIERS.has(identifier)
      );
      if (invalid.length > 0) unknown.set(concept.code, invalid);
    }

    expect([...unknown.entries()]).toEqual([]);
  });

  it('las alícuotas del salario integral están marcadas como tal', () => {
    const integral = CONCEPT_SEED.filter(
      concept => concept.category === 'INFORMATIVE' && concept.affectsIntegralSalary
    ).map(concept => concept.code);

    expect(integral).toEqual(['UTIL_ALLOWANCE', 'BONUS_ALLOWANCE']);
  });

  it('el cestaticket no es salarial (Ley de Alimentación)', () => {
    const cestaticket = CONCEPT_SEED.find(concept => concept.code === 'CESTATICKET');
    expect(cestaticket?.isSalarial).toBe(false);
  });

  it('la retención de ISLR nace como fórmula, no como importe fijo (P-30)', () => {
    // Un `ISLR` FIXED sin expresión deja la retención en 0 y el run no avisa (H-105).
    const islr = CONCEPT_SEED.find(concept => concept.code === 'ISLR');
    expect(islr?.kind).toBe('FORMULA');
    expect(islr?.expression).toBe('ISLR_WITHHOLDING');
  });

  it('los aportes del trabajador son los desgravables del catálogo (P-30)', () => {
    const desgravables = CONCEPT_SEED.filter(concept => concept.reducesIncomeTaxBase).map(
      concept => concept.code
    );

    expect(desgravables.sort()).toEqual(['FAOV_EMP', 'PIE_EMP', 'SSO_EMP']);
  });

  it('las deducciones legales usan su base acotada, no el salario normal directo', () => {
    const bases: Record<string, string> = {
      SSO_EMP: 'BASE_IVSS',
      PIE_EMP: 'BASE_PARO',
      FAOV_EMP: 'BASE_FAOV',
      SSO_PAT: 'BASE_IVSS',
      PIE_PAT: 'BASE_PARO',
      FAOV_PAT: 'BASE_FAOV',
    };

    for (const [code, base] of Object.entries(bases)) {
      const concept = CONCEPT_SEED.find(item => item.code === code);
      expect(concept?.expression, `${code} debe usar ${base}`).toContain(base);
    }
  });
});

describe('catálogo de parámetros de nómina', () => {
  it('no repite claves', () => {
    const keys = SETTING_SEED.map(setting => setting.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('los porcentajes se cargan como porcentaje entero dentro de (0, 100]', () => {
    for (const setting of SETTING_SEED.filter(item => item.type === 'PERCENT')) {
      const value = Number(setting.value);
      expect(value, setting.key).toBeGreaterThan(0);
      expect(value, setting.key).toBeLessThanOrEqual(100);
    }
  });

  it('el cestaticket se declara en divisa para que el motor lo convierta', () => {
    const cestaticket = SETTING_SEED.find(setting => setting.key === 'CESTATICKET_USD');
    expect(cestaticket?.type).toBe('MONEY_USD');
  });

  it('no siembra valores que dependen de decretos sin confirmar (P-28)', () => {
    const keys = SETTING_SEED.map(setting => setting.key);
    expect(keys).not.toContain('SALARIO_MINIMO');
    expect(keys).not.toContain('UNIDAD_TRIBUTARIA');
  });
});
