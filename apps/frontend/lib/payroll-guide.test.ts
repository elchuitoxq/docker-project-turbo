import { describe, expect, it } from 'vitest';
import {
  GUIDE_ITEMS,
  computeIslr,
  guideProgress,
  itemStatus,
  sumTaxDeductions,
} from './payroll-guide';

const complete = {
  SSO_EMP: 4,
  SSO_PAT: 10,
  TOPE_SSO: 650,
  PIE_EMP: 0.5,
  PIE_PAT: 2,
  TOPE_PARO: 1300,
  FAOV_EMP: 1,
  FAOV_PAT: 2,
  TOPE_FAOV: 0,
  CESTATICKET_USD: 40,
  DIAS_UTILIDADES: 30,
  TOPE_UTILIDADES_MESES: 4,
  DIAS_VACACIONES_BASE: 15,
  DIAS_BONO_VACACIONAL: 7,
  TOPE_DIAS_VACACIONES_EXTRA: 15,
  UNIDAD_TRIBUTARIA: 43,
  ISLR_DESCUENTO_UNICO: 0,
};

const findBy = (id: string) => GUIDE_ITEMS.find(item => item.id === id)!;

describe('GUIDE_ITEMS', () => {
  it('cubre los siete componentes de P-28 y no se repite', () => {
    expect(GUIDE_ITEMS).toHaveLength(7);
    expect(new Set(GUIDE_ITEMS.map(item => item.id)).size).toBe(7);
  });

  it('cada bloque explica ley, SAP y decisión', () => {
    for (const item of GUIDE_ITEMS) {
      expect(item.summary.length).toBeGreaterThan(20);
      expect(item.sap.length).toBeGreaterThan(30);
      expect(item.legal.length).toBeGreaterThan(30);
      expect(item.decision.length).toBeGreaterThan(20);
      expect(item.keys.length).toBeGreaterThan(0);
    }
  });
});

describe('itemStatus', () => {
  it('marca pendiente cuando no hay ningún parámetro informado', () => {
    expect(itemStatus(findBy('cestaticket'), {})).toBe('pendiente');
  });

  it('marca configurado cuando todos los parámetros tienen valor', () => {
    expect(itemStatus(findBy('ivss'), complete)).toBe('configurado');
  });

  it('marca revisar si falta alguno de los parámetros', () => {
    expect(itemStatus(findBy('ivss'), { SSO_EMP: 4 })).toBe('revisar');
  });

  it('marca revisar cuando la fuente legal es de confianza baja, aunque esté completo', () => {
    const sinTope = { ...complete, TOPE_FAOV: 1 };

    expect(itemStatus(findBy('faov'), sinTope)).toBe('revisar');
    expect(itemStatus(findBy('utilidades'), complete)).toBe('revisar');
  });

  it('trata el 0 como valor ausente', () => {
    expect(itemStatus(findBy('islr'), { UNIDAD_TRIBUTARIA: 0, ISLR_DESCUENTO_UNICO: 0 })).toBe(
      'pendiente'
    );
  });
});

describe('guideProgress', () => {
  it('cuenta configurados, pendientes y a revisar', () => {
    const progress = guideProgress(GUIDE_ITEMS, complete);

    expect(progress.total).toBe(7);
    expect(progress.configured + progress.review + progress.pending).toBe(7);
    expect(progress.configured).toBeGreaterThan(0);
  });

  it('con la nada configurada el avance es 0 %', () => {
    expect(guideProgress(GUIDE_ITEMS, {}).percent).toBe(0);
  });
});

/** La tabla real del Art. 50 con su valor de UT, tal como la devuelve `/hr/income-tax-table`. */
const BRACKETS = [
  { fromUt: 0, toUt: 1000, rate: 0.06, discountUt: 0 },
  { fromUt: 1000, toUt: 1500, rate: 0.09, discountUt: 30 },
  { fromUt: 1500, toUt: 2000, rate: 0.12, discountUt: 75 },
  { fromUt: 2000, toUt: 2500, rate: 0.16, discountUt: 155 },
  { fromUt: 2500, toUt: 3000, rate: 0.2, discountUt: 255 },
  { fromUt: 3000, toUt: 4000, rate: 0.24, discountUt: 375 },
  { fromUt: 4000, toUt: 6000, rate: 0.29, discountUt: 575 },
  { fromUt: 6000, toUt: null, rate: 0.34, discountUt: 875 },
];
const UT = 43;

describe('sumTaxDeductions', () => {
  it('sólo suma los conceptos marcados como desgravables', () => {
    const amounts = { SSO_EMP: 400, PIE_EMP: 50, FAOV_EMP: 100, ISLR: 900 };

    expect(sumTaxDeductions(amounts, ['SSO_EMP', 'PIE_EMP', 'FAOV_EMP'])).toBe(550);
    expect(sumTaxDeductions(amounts, ['SSO_EMP'])).toBe(400);
  });

  it('sin conceptos marcados no desgrava nada', () => {
    expect(sumTaxDeductions({ SSO_EMP: 400, PIE_EMP: 50 }, [])).toBe(0);
  });

  it('ignora códigos marcados que no tengan importe', () => {
    expect(sumTaxDeductions({ SSO_EMP: 400 }, ['SSO_EMP', 'HCM'])).toBe(400);
  });
});

describe('computeIslr', () => {
  it('reproduce la retención verificada contra el backend (365.000 Bs/mes)', () => {
    // Base anual 4.380.000 Bs = 101.860,47 UT → tramo 34 % − 875 UT. El run NOM-000003 retuvo 120.964,58.
    expect(computeIslr(4_380_000, BRACKETS, UT)).toBe(120_964.58);
  });

  it('aplica el sustraendo de cada tramo y prorratea en 12 meses', () => {
    // 2.500 UT al 16 % − 155 UT = 245 UT = 10.535 Bs anuales → 877,92 al mes.
    expect(computeIslr(2500 * UT, BRACKETS, UT)).toBe(877.92);
  });

  it('la tarifa es continua: un céntimo más en la base no salta el impuesto', () => {
    const antes = computeIslr(3000 * UT - 0.01, BRACKETS, UT);
    const justo = computeIslr(3000 * UT, BRACKETS, UT);

    expect(Math.abs(justo - antes)).toBeLessThan(1);
  });

  it('sin tabla o sin UT devuelve 0 en vez de inventar una retención', () => {
    expect(computeIslr(1_000_000, [], UT)).toBe(0);
    expect(computeIslr(1_000_000, BRACKETS, 0)).toBe(0);
  });

  it('con base cero no retiene nada', () => {
    expect(computeIslr(0, BRACKETS, UT)).toBe(0);
  });

  it('el descuento único nunca deja la retención en negativo', () => {
    expect(computeIslr(2500 * UT, BRACKETS, UT, 99_999)).toBe(0);
  });
});
