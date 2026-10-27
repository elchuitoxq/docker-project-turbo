import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../index';
import { payrollConceptTypes, payrollSettings, uuidv7 } from '../schema';

/**
 * Catálogo de nómina por empresa (`T-02-01` / `T-02-02`).
 *
 * Deja cargado lo que es estructura y no cambia por decreto: los conceptos del sistema y los
 * parámetros con vigencia. Los valores que dependen de decretos (salario mínimo, unidad
 * tributaria) **no** se siembran a propósito: inventarlos sería peor que no tenerlos.
 * Ver `docs/09-HR-NOMINA-VENEZUELA.md` §10 y §15.
 */

/** Vigencia inicial del catálogo: cualquier período posterior la toma. */
const CATALOG_EFFECTIVE_FROM = new Date('2020-01-01T00:00:00.000Z');

interface ConceptSeed {
  code: string;
  name: string;
  category: 'ASSIGNMENT' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION' | 'INFORMATIVE';
  kind: 'FIXED' | 'PERCENT' | 'FORMULA' | 'BASE';
  expression?: string;
  affectsIntegralSalary?: boolean;
  isSalarial?: boolean;
}

const CONCEPT_SEED: ConceptSeed[] = [
  {
    code: 'SALARY',
    name: 'Sueldo del período',
    category: 'ASSIGNMENT',
    kind: 'FORMULA',
    expression: 'SALARY_BASE * (PERIOD_DAYS / MONTH_DAYS)',
    affectsIntegralSalary: true,
  },
  {
    code: 'PRIMA',
    name: 'Primas habituales',
    category: 'ASSIGNMENT',
    kind: 'FIXED',
    affectsIntegralSalary: true,
  },
  {
    code: 'OVERTIME',
    name: 'Horas extraordinarias',
    category: 'ASSIGNMENT',
    kind: 'FORMULA',
    expression: 'HOURS * HOUR_RATE',
    affectsIntegralSalary: true,
  },
  {
    code: 'CESTATICKET',
    name: 'Cestaticket',
    category: 'ASSIGNMENT',
    kind: 'FORMULA',
    expression: 'CESTATICKET_USD * (PERIOD_DAYS / MONTH_DAYS)',
    affectsIntegralSalary: false,
    isSalarial: false,
  },
  {
    code: 'VACATION_PAY',
    name: 'Pago de vacaciones',
    category: 'ASSIGNMENT',
    kind: 'FORMULA',
    expression: 'SALARY_NORMAL * (PERIOD_DAYS / MONTH_DAYS)',
    affectsIntegralSalary: false,
  },
  {
    code: 'VACATION_BONUS',
    name: 'Bono vacacional',
    category: 'ASSIGNMENT',
    kind: 'FIXED',
    affectsIntegralSalary: false,
  },
  {
    code: 'PROFIT_SHARING',
    name: 'Utilidades',
    category: 'ASSIGNMENT',
    kind: 'FIXED',
    affectsIntegralSalary: false,
  },
  {
    code: 'RETRO',
    name: 'Diferencia retroactiva',
    category: 'ASSIGNMENT',
    kind: 'FIXED',
    affectsIntegralSalary: true,
  },
  {
    code: 'SSO_EMP',
    name: 'Seguro social trabajador',
    category: 'DEDUCTION',
    kind: 'FORMULA',
    expression: 'SALARY_NORMAL * SSO_EMP / 100',
  },
  {
    code: 'PIE_EMP',
    name: 'Paro forzoso trabajador',
    category: 'DEDUCTION',
    kind: 'FORMULA',
    expression: 'SALARY_NORMAL * PIE_EMP / 100',
  },
  {
    code: 'FAOV_EMP',
    name: 'FAOV trabajador',
    category: 'DEDUCTION',
    kind: 'FORMULA',
    expression: 'SALARY_NORMAL * FAOV_EMP / 100',
  },
  { code: 'ISLR', name: 'Retención de ISLR', category: 'DEDUCTION', kind: 'FIXED' },
  {
    code: 'SSO_PAT',
    name: 'Seguro social patronal',
    category: 'EMPLOYER_CONTRIBUTION',
    kind: 'FORMULA',
    expression: 'SALARY_NORMAL * SSO_PAT / 100',
  },
  {
    code: 'PIE_PAT',
    name: 'Paro forzoso patronal',
    category: 'EMPLOYER_CONTRIBUTION',
    kind: 'FORMULA',
    expression: 'SALARY_NORMAL * PIE_PAT / 100',
  },
  {
    code: 'FAOV_PAT',
    name: 'FAOV patronal',
    category: 'EMPLOYER_CONTRIBUTION',
    kind: 'FORMULA',
    expression: 'SALARY_NORMAL * FAOV_PAT / 100',
  },
  {
    code: 'BENEFIT_GUARANTEE',
    name: 'Garantía trimestral de prestaciones',
    category: 'INFORMATIVE',
    kind: 'FORMULA',
    expression: 'SALARY_INTEGRAL * DIAS_GARANTIA_TRIMESTRE',
  },
  {
    code: 'UTIL_ALLOWANCE',
    name: 'Alícuota de utilidades',
    category: 'INFORMATIVE',
    kind: 'FORMULA',
    expression: '(DIAS_UTILIDADES * SALARY_NORMAL) / 360',
  },
  {
    code: 'BONUS_ALLOWANCE',
    name: 'Alícuota de bono vacacional',
    category: 'INFORMATIVE',
    kind: 'FORMULA',
    expression: '(DIAS_BONO_VACACIONAL * SALARY_NORMAL) / 360',
  },
];

interface SettingSeed {
  key: string;
  label: string;
  type: 'PERCENT' | 'MONEY' | 'NUMBER';
  value: string;
}

/**
 * Parámetros estructurales. Las alícuotas y los montos siguen siendo **a validar** antes de
 * producción (P-28): se siembran con el valor histórico conocido, no como verdad legal.
 */
const SETTING_SEED: SettingSeed[] = [
  { key: 'SSO_EMP', label: 'Seguro social trabajador (%)', type: 'PERCENT', value: '4' },
  { key: 'SSO_PAT', label: 'Seguro social patronal (%)', type: 'PERCENT', value: '10' },
  { key: 'FAOV_EMP', label: 'FAOV trabajador (%)', type: 'PERCENT', value: '1' },
  { key: 'FAOV_PAT', label: 'FAOV patronal (%)', type: 'PERCENT', value: '2' },
  { key: 'PIE_EMP', label: 'Paro forzoso trabajador (%)', type: 'PERCENT', value: '0.5' },
  { key: 'PIE_PAT', label: 'Paro forzoso patronal (%)', type: 'PERCENT', value: '2' },
  { key: 'CESTATICKET_USD', label: 'Cestaticket mensual', type: 'MONEY', value: '40' },
  { key: 'DIAS_UTILIDADES', label: 'Días mínimos de utilidades', type: 'NUMBER', value: '30' },
  {
    key: 'TOPE_UTILIDADES_MESES',
    label: 'Tope de utilidades en meses',
    type: 'NUMBER',
    value: '4',
  },
  { key: 'DIAS_VACACIONES_BASE', label: 'Días base de vacaciones', type: 'NUMBER', value: '15' },
  {
    key: 'TOPE_DIAS_VACACIONES_EXTRA',
    label: 'Tope de días extra de vacaciones',
    type: 'NUMBER',
    value: '15',
  },
  {
    key: 'DIAS_BONO_VACACIONAL',
    label: 'Días base de bono vacacional',
    type: 'NUMBER',
    value: '7',
  },
  {
    key: 'TOPE_DIAS_BONO_EXTRA',
    label: 'Tope de días extra de bono vacacional',
    type: 'NUMBER',
    value: '21',
  },
  {
    key: 'DIAS_GARANTIA_TRIMESTRE',
    label: 'Días de garantía por trimestre',
    type: 'NUMBER',
    value: '15',
  },
  {
    key: 'DIAS_ADICIONALES_ANIO',
    label: 'Días adicionales por año de servicio',
    type: 'NUMBER',
    value: '2',
  },
  {
    key: 'TOPE_DIAS_ADICIONALES',
    label: 'Tope de días adicionales acumulados',
    type: 'NUMBER',
    value: '30',
  },
];

export async function seedPayrollCatalog(companyId: string): Promise<void> {
  for (const concept of CONCEPT_SEED) {
    await db
      .insert(payrollConceptTypes)
      .values({
        id: uuidv7(),
        companyId,
        code: concept.code,
        name: concept.name,
        category: concept.category,
        kind: concept.kind,
        expression: concept.expression ?? null,
        affectsIntegralSalary: concept.affectsIntegralSalary ?? false,
        isSalarial: concept.isSalarial ?? true,
        isSystem: true,
        branchId: null,
      })
      .onConflictDoUpdate({
        target: [payrollConceptTypes.companyId, payrollConceptTypes.code],
        // La fórmula no se sobrescribe: si la empresa la ajustó, el seed no debe revertirla.
        set: {
          name: concept.name,
          category: concept.category,
          kind: concept.kind,
          affectsIntegralSalary: concept.affectsIntegralSalary ?? false,
          isSalarial: concept.isSalarial ?? true,
          isSystem: true,
        },
      });
  }
  console.log(`Seeded ${CONCEPT_SEED.length} system payroll concepts`);

  let created = 0;
  for (const setting of SETTING_SEED) {
    const [existing] = await db
      .select({ id: payrollSettings.id })
      .from(payrollSettings)
      .where(
        and(
          eq(payrollSettings.companyId, companyId),
          eq(payrollSettings.key, setting.key),
          isNull(payrollSettings.branchId),
          eq(payrollSettings.effectiveFrom, CATALOG_EFFECTIVE_FROM)
        )
      )
      .limit(1);

    if (existing) continue;

    await db.insert(payrollSettings).values({
      id: uuidv7(),
      companyId,
      key: setting.key,
      label: setting.label,
      value: setting.value,
      type: setting.type,
      branchId: null,
      effectiveFrom: CATALOG_EFFECTIVE_FROM,
      isActive: true,
    });
    created += 1;
  }
  console.log(`Seeded ${created} payroll settings (${SETTING_SEED.length} catalogados)`);
}
