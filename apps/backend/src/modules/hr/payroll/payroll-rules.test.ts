import { describe, expect, it } from 'vitest';
import { tokenizeExpression, validateConceptExpression } from './concept-expression';
import { resolvePayrollSettings, validateSettingValue } from './settings-resolver';

/**
 * Reglas de `T-02-01` (vigencia de parámetros) y `T-02-02` (fórmulas de conceptos).
 * Todo lo que se prueba aquí es puro: no toca base de datos.
 */
describe('validateConceptExpression', () => {
  it('acepta las bases de cálculo y los parámetros de la empresa', () => {
    expect(validateConceptExpression('SALARY_NORMAL * SSO_EMP / 100', ['SSO_EMP'])).toBeNull();
    expect(
      validateConceptExpression('(DIAS_UTILIDADES * SALARY_NORMAL) / 360', ['DIAS_UTILIDADES'])
    ).toBeNull();
  });

  it('acepta operadores unarios y paréntesis anidados', () => {
    expect(validateConceptExpression('-HOURS * HOUR_RATE')).toBeNull();
    expect(validateConceptExpression('((SALARY_BASE + 10) * (1 - 0.5))')).toBeNull();
  });

  it('rechaza identificadores desconocidos', () => {
    const error = validateConceptExpression('SALARY_NORMAL * NO_EXISTE');
    expect(error).toContain('NO_EXISTE');
  });

  it('rechaza parámetros que no están cargados en la empresa', () => {
    expect(validateConceptExpression('SALARY_NORMAL * SSO_EMP / 100', [])).toContain('SSO_EMP');
  });

  it('rechaza paréntesis desbalanceados', () => {
    expect(validateConceptExpression('(SALARY_BASE * 2')).toBe('Paréntesis sin cerrar');
    expect(validateConceptExpression('SALARY_BASE * 2)')).toBeDefined();
  });

  it('rechaza operadores sin operando', () => {
    expect(validateConceptExpression('SALARY_BASE *')).toBeDefined();
    expect(validateConceptExpression('* SALARY_BASE')).toBeDefined();
  });

  it('rechaza caracteres fuera del alfabeto, incluido cualquier intento de código', () => {
    expect(validateConceptExpression('SALARY_BASE; DROP TABLE users')).toBeDefined();
    expect(validateConceptExpression('require("fs")')).toBeDefined();
    expect(validateConceptExpression('process.exit(1)')).toContain('process');
  });

  it('rechaza expresiones vacías o demasiado largas', () => {
    expect(validateConceptExpression('   ')).toBe('La expresión está vacía');
    expect(validateConceptExpression('1 + '.repeat(60) + '1')).toBeDefined();
  });

  it('tokeniza dejando fuera los espacios', () => {
    expect(tokenizeExpression('SALARY_BASE * (PERIOD_DAYS / MONTH_DAYS)')).toEqual([
      'SALARY_BASE',
      '*',
      '(',
      'PERIOD_DAYS',
      '/',
      'MONTH_DAYS',
      ')',
    ]);
  });
});

describe('resolvePayrollSettings', () => {
  const row = (
    key: string,
    value: string,
    effectiveFrom: string,
    branchId: string | null = null,
    extra: Partial<{ isActive: boolean; id: string }> = {}
  ) => ({
    id: extra.id ?? `${key}-${effectiveFrom}-${branchId ?? 'company'}`,
    key,
    label: key,
    value,
    type: 'PERCENT',
    branchId,
    effectiveFrom: new Date(effectiveFrom),
    isActive: extra.isActive ?? true,
  });

  it('toma la vigencia aplicable a la fecha del período, no la última cargada', () => {
    const rows = [
      row('SSO_EMP', '4', '2024-01-01T00:00:00.000Z'),
      row('SSO_EMP', '5', '2026-06-01T00:00:00.000Z'),
    ];

    const january = resolvePayrollSettings(rows, { asOf: new Date('2026-01-15T00:00:00.000Z') });
    const july = resolvePayrollSettings(rows, { asOf: new Date('2026-07-15T00:00:00.000Z') });

    expect(january.map(r => r.value)).toEqual(['4']);
    expect(july.map(r => r.value)).toEqual(['5']);
  });

  it('ignora las vigencias futuras', () => {
    const rows = [row('FAOV_EMP', '1', '2027-01-01T00:00:00.000Z')];
    expect(resolvePayrollSettings(rows, { asOf: new Date('2026-05-01T00:00:00.000Z') })).toEqual(
      []
    );
  });

  it('da precedencia al valor de la sucursal sobre el de la empresa', () => {
    const rows = [
      row('PIE_EMP', '0.5', '2020-01-01T00:00:00.000Z', null),
      row('PIE_EMP', '0.6', '2020-01-01T00:00:00.000Z', 'branch-a'),
    ];

    const forBranchA = resolvePayrollSettings(rows, {
      asOf: new Date('2026-05-01T00:00:00.000Z'),
      branchId: 'branch-a',
    });
    const forBranchB = resolvePayrollSettings(rows, {
      asOf: new Date('2026-05-01T00:00:00.000Z'),
      branchId: 'branch-b',
    });

    expect(forBranchA.map(r => r.value)).toEqual(['0.6']);
    expect(forBranchB.map(r => r.value)).toEqual(['0.5']);
  });

  it('no deja que el valor de una sucursal se filtre a otra', () => {
    const rows = [row('SSO_EMP', '9', '2020-01-01T00:00:00.000Z', 'branch-a')];
    expect(
      resolvePayrollSettings(rows, { asOf: new Date('2026-05-01T00:00:00.000Z'), branchId: 'b' })
    ).toEqual([]);
  });

  it('descarta parámetros inactivos y devuelve una sola fila por clave', () => {
    const rows = [
      row('SSO_EMP', '4', '2024-01-01T00:00:00.000Z'),
      row('SSO_EMP', '7', '2025-01-01T00:00:00.000Z', null, { isActive: false }),
    ];

    const resolved = resolvePayrollSettings(rows, { asOf: new Date('2026-05-01T00:00:00.000Z') });
    expect(resolved).toHaveLength(1);
    expect(resolved[0].value).toBe('4');
  });
});

describe('validateSettingValue', () => {
  it('acepta porcentajes como porcentaje entero dentro de (0, 100]', () => {
    expect(validateSettingValue('PERCENT', 4)).toBeNull();
    expect(validateSettingValue('PERCENTAGE', 0.5)).toBeNull();
  });

  it('rechaza valores fuera de (0, 100]', () => {
    expect(validateSettingValue('PERCENT', 400)).toContain('porcentaje entero');
    expect(validateSettingValue('PERCENT', 0)).toContain('porcentaje entero');
  });

  it('acepta montos no negativos y rechaza negativos', () => {
    expect(validateSettingValue('MONEY', 40)).toBeNull();
    expect(validateSettingValue('MONEY', -1)).toContain('negativo');
  });
});
