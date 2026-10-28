import { BadRequestException } from '@nestjs/common';

/** Categoría del concepto (`payroll_concept_types.category`). */
export type PayrollConceptCategory =
  'ASSIGNMENT' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION' | 'INFORMATIVE';

/** Línea del run: lo que el motor calculó por empleado y concepto. */
export interface PayrollRunLine {
  conceptCode: string;
  conceptName: string;
  category: string;
  amount: number;
}

/** Mapa contable del concepto (`accounting_maps` con `module = 'PAYROLL'`). */
export interface PayrollAccountMap {
  transactionType: string;
  debitAccountId: string | null;
  creditAccountId: string | null;
}

export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
}

export interface PayrollPostingResult {
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  /** Conceptos que quedaron fuera porque su categoría es informativa. */
  skipped: string[];
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Los conceptos informativos exponen bases y alícuotas: no mueven cuentas. */
function carriesAmount(line: PayrollRunLine): boolean {
  return line.category !== 'INFORMATIVE' && Math.abs(line.amount) > 0.004;
}

/**
 * Construye el asiento de un run de nómina a partir de sus líneas y de `accounting_maps`
 * (`RN-25`, §12 de `09-HR-NOMINA-VENEZUELA.md`).
 *
 * Cada concepto aporta **su par débito/crédito** según su mapeo, así que el asiento siempre cuadra
 * por construcción: lo que se debita por un concepto se acredita en la misma línea. El neto a pagar
 * queda como saldo de la cuenta de sueldos por pagar (acreditada por las asignaciones y debitada por
 * las deducciones).
 *
 * Si un concepto con monto no tiene mapeo, **falla**: es preferible un run detenido a un libro
 * descuadrado (RN-25).
 */
export function buildPayrollJournalLines(
  lines: PayrollRunLine[],
  maps: PayrollAccountMap[]
): PayrollPostingResult {
  const byConcept = new Map(maps.map(map => [map.transactionType, map]));

  const grouped = new Map<string, JournalLine>();
  const skipped: string[] = [];
  const missing: string[] = [];

  const add = (accountId: string, debit: number, credit: number) => {
    const current = grouped.get(accountId) ?? { accountId, debit: 0, credit: 0 };
    current.debit = round(current.debit + debit);
    current.credit = round(current.credit + credit);
    grouped.set(accountId, current);
  };

  for (const line of lines) {
    if (!carriesAmount(line)) {
      if (line.category === 'INFORMATIVE') skipped.push(line.conceptCode);
      continue;
    }

    const map = byConcept.get(line.conceptCode);
    if (!map || !map.debitAccountId || !map.creditAccountId) {
      missing.push(`${line.conceptCode} (${line.conceptName})`);
      continue;
    }

    add(map.debitAccountId, line.amount, 0);
    add(map.creditAccountId, 0, line.amount);
  }

  if (missing.length > 0) {
    throw new BadRequestException(
      `Falta el mapeo contable de ${missing.length} concepto(s) con monto: ${[
        ...new Set(missing),
      ].join(
        ', '
      )}. Configúrelo en Contabilidad → Mapeos (módulo PAYROLL) antes de contabilizar el run.`
    );
  }

  const result = [...grouped.values()]
    .filter(line => line.debit > 0 || line.credit > 0)
    .sort((a, b) => b.debit + b.credit - (a.debit + a.credit));

  const totalDebit = round(result.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = round(result.reduce((sum, line) => sum + line.credit, 0));

  if (result.length === 0) {
    throw new BadRequestException('El run no tiene conceptos con monto para contabilizar');
  }

  return { lines: result, totalDebit, totalCredit, skipped };
}
