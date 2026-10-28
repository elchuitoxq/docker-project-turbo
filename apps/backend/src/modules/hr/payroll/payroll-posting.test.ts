import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  buildPayrollJournalLines,
  type PayrollAccountMap,
  type PayrollRunLine,
} from './payroll-posting';

const SUELDOS_PAGAR = 'acc-payable';
const GASTO_SUELDOS = 'acc-expense-salary';
const GASTO_APORTES = 'acc-expense-employer';
const IVSS_PAGAR = 'acc-ivss';
const ISLR_PAGAR = 'acc-islr';

const maps: PayrollAccountMap[] = [
  { transactionType: 'SALARY', debitAccountId: GASTO_SUELDOS, creditAccountId: SUELDOS_PAGAR },
  { transactionType: 'PRIMA', debitAccountId: GASTO_SUELDOS, creditAccountId: SUELDOS_PAGAR },
  { transactionType: 'SSO_EMP', debitAccountId: SUELDOS_PAGAR, creditAccountId: IVSS_PAGAR },
  { transactionType: 'ISLR', debitAccountId: SUELDOS_PAGAR, creditAccountId: ISLR_PAGAR },
  { transactionType: 'SSO_PAT', debitAccountId: GASTO_APORTES, creditAccountId: IVSS_PAGAR },
];

function line(
  conceptCode: string,
  amount: number,
  category: PayrollRunLine['category'] = 'ASSIGNMENT'
): PayrollRunLine {
  return { conceptCode, conceptName: conceptCode, category, amount };
}

describe('buildPayrollJournalLines (RN-25)', () => {
  it('suma por cuenta y deja el neto como saldo de sueldos por pagar', () => {
    const result = buildPayrollJournalLines(
      [
        line('SALARY', 1000),
        line('PRIMA', 100),
        line('SSO_EMP', 40, 'DEDUCTION'),
        line('ISLR', 10, 'DEDUCTION'),
      ],
      maps
    );

    const byAccount = new Map(result.lines.map(item => [item.accountId, item]));

    expect(byAccount.get(GASTO_SUELDOS)).toMatchObject({ debit: 1100, credit: 0 });
    expect(byAccount.get(SUELDOS_PAGAR)).toMatchObject({ debit: 50, credit: 1100 });
    expect(byAccount.get(IVSS_PAGAR)).toMatchObject({ debit: 0, credit: 40 });
    expect(byAccount.get(ISLR_PAGAR)).toMatchObject({ debit: 0, credit: 10 });
    expect(result.totalDebit).toBe(result.totalCredit);

    // Neto a pagar = 1.100 asignaciones − 50 deducciones
    const payable = byAccount.get(SUELDOS_PAGAR);
    expect((payable?.credit ?? 0) - (payable?.debit ?? 0)).toBe(1050);
  });

  it('incluye aportes patronales como gasto sin tocar el neto', () => {
    const result = buildPayrollJournalLines(
      [line('SALARY', 1000), line('SSO_PAT', 90, 'EMPLOYER_CONTRIBUTION')],
      maps
    );

    const byAccount = new Map(result.lines.map(item => [item.accountId, item]));
    expect(byAccount.get(GASTO_APORTES)).toMatchObject({ debit: 90 });
    expect(byAccount.get(IVSS_PAGAR)).toMatchObject({ credit: 90 });
    expect(byAccount.get(SUELDOS_PAGAR)).toMatchObject({ credit: 1000, debit: 0 });
  });

  it('falla si un concepto con monto no tiene mapeo (RN-25)', () => {
    expect(() =>
      buildPayrollJournalLines([line('SALARY', 1000), line('CESTATICKET', 50)], maps)
    ).toThrow(BadRequestException);
    expect(() =>
      buildPayrollJournalLines([line('SALARY', 1000), line('CESTATICKET', 50)], maps)
    ).toThrow(/CESTATICKET/);
  });

  it('falla si el mapeo existe pero le falta una de las cuentas', () => {
    const incompleto: PayrollAccountMap[] = [
      { transactionType: 'SALARY', debitAccountId: GASTO_SUELDOS, creditAccountId: null },
    ];

    expect(() => buildPayrollJournalLines([line('SALARY', 100)], incompleto)).toThrow(/SALARY/);
  });

  it('ignora los conceptos informativos y los de monto cero', () => {
    const result = buildPayrollJournalLines(
      [line('SALARY', 500), line('IVSS_BASE', 500, 'INFORMATIVE'), line('PRIMA', 0)],
      maps
    );

    expect(result.skipped).toEqual(['IVSS_BASE']);
    expect(result.lines).toHaveLength(2);
    expect(result.totalDebit).toBe(500);
  });

  it('redondea a dos decimales sin descuadrar', () => {
    const result = buildPayrollJournalLines(
      [line('SALARY', 100.005), line('SSO_EMP', 0.335, 'DEDUCTION')],
      maps
    );

    expect(result.totalDebit).toBe(result.totalCredit);
    // 100,005 → 100,01 y 0,335 → 0,34: la suma se hace con los importes ya redondeados.
    expect(result.totalDebit).toBe(100.35);
  });

  it('falla cuando el run no tiene nada que contabilizar', () => {
    expect(() => buildPayrollJournalLines([line('IVSS_BASE', 100, 'INFORMATIVE')], maps)).toThrow(
      /no tiene conceptos con monto/
    );
  });
});
