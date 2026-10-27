import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, lte, inArray, sql } from 'drizzle-orm';
import { db } from '../../../database';
import { accountingPeriods, branches, invoices, partners, taxRetentions } from '../../../schema';
import { validateRif } from './rif.validator';
import { FiscalBookService } from './fiscal-book.service';

export type ValidationSeverity = 'ERROR' | 'WARNING';

export type ValidationFinding = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  entity?: string;
  entityId?: string;
};

export type FiscalValidation = {
  branchId: string;
  from: string | null;
  to: string | null;
  findings: ValidationFinding[];
  errors: number;
  warnings: number;
  /** Sin hallazgos de severidad `ERROR` se puede exportar. */
  canExport: boolean;
};

/**
 * Validaciones previas a exportar (`T-06-04`). Un error acá tiene consecuencia legal, así que se
 * revisa antes de generar el archivo y el `POST /exports` se niega con `409` si hay errores.
 *
 * Códigos:
 * - `RIF_INVALID` (ERROR): RIF con formato inválido en un documento del período.
 * - `RIF_CHECK_DIGIT` (WARNING): el dígito verificador no coincide (regla ⚠️ pendiente de confirmar).
 * - `CONTROL_NUMBER_MISSING` (ERROR): factura de venta sin número de control.
 * - `CONTROL_NUMBER_DUPLICATED` (ERROR): dos comprobantes con el mismo número de control.
 * - `SEQUENCE_GAP` (WARNING): hueco en la numeración `A-nnnnn` del período.
 * - `PERIOD_CLOSED` (WARNING): el rango cruza un cierre contable (regla 6 de `S-06`).
 * - `BOOK_INCONSISTENT` (ERROR): el libro no reconstruye el total desde base + IVA + exento.
 */
@Injectable()
export class FiscalValidationService {
  constructor(private readonly books: FiscalBookService = new FiscalBookService()) {}

  async validate(branchId: string, from?: string, to?: string): Promise<FiscalValidation> {
    const findings: ValidationFinding[] = [];

    const [branch] = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1);

    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} not found`);
    }

    const dateFilter = [
      ...(from ? [gte(invoices.date, new Date(from))] : []),
      ...(to ? [lte(invoices.date, new Date(`${to.slice(0, 10)}T23:59:59.999Z`))] : []),
    ];

    const periodInvoices = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.branchId, branchId), ...dateFilter));

    const partnerIds = [...new Set(periodInvoices.map(invoice => invoice.partnerId))];
    const partnerRows =
      partnerIds.length > 0
        ? await db.select().from(partners).where(inArray(partners.id, partnerIds))
        : [];
    const partnerById = new Map(partnerRows.map(partner => [partner.id, partner]));

    // 1. RIF de los partners que aparecen en el período.
    for (const partner of partnerRows) {
      const check = validateRif(partner.taxId);

      if (!check.formatValid) {
        findings.push({
          code: 'RIF_INVALID',
          severity: 'ERROR',
          message: `${partner.name}: ${check.reason ?? 'RIF inválido'}`,
          entity: 'partners',
          entityId: partner.id,
        });
      } else if (!check.checkDigitValid) {
        findings.push({
          code: 'RIF_CHECK_DIGIT',
          severity: 'WARNING',
          message: `${partner.name} (${check.normalized}): ${check.reason}`,
          entity: 'partners',
          entityId: partner.id,
        });
      }
    }

    // 2. Número de control en ventas.
    const salesInvoices = periodInvoices.filter(invoice => invoice.type === 'SALE');

    for (const invoice of salesInvoices) {
      if (!invoice.invoiceNumber) {
        findings.push({
          code: 'CONTROL_NUMBER_MISSING',
          severity: 'ERROR',
          message: `La factura ${invoice.code} no tiene número de control`,
          entity: 'invoices',
          entityId: invoice.id,
        });
      }
    }

    // 3. Números de control repetidos.
    const seenControl = new Map<string, string>();
    for (const invoice of salesInvoices) {
      const control = invoice.invoiceNumber?.trim();
      if (!control) continue;

      const previous = seenControl.get(control);
      if (previous) {
        findings.push({
          code: 'CONTROL_NUMBER_DUPLICATED',
          severity: 'ERROR',
          message: `El número de control ${control} está repetido (${previous} y ${invoice.code})`,
          entity: 'invoices',
          entityId: invoice.id,
        });
      } else {
        seenControl.set(control, invoice.code);
      }
    }

    // 4. Huecos en la numeración `A-nnnnn` del período.
    const numbers = periodInvoices
      .map(invoice => /^A-(\d+)$/.exec(invoice.code)?.[1])
      .filter((value): value is string => !!value)
      .map(Number)
      .sort((a, b) => a - b);

    if (numbers.length > 1) {
      const holes: number[] = [];
      for (let i = 1; i < numbers.length; i += 1) {
        for (let missing = numbers[i - 1] + 1; missing < numbers[i]; missing += 1) {
          holes.push(missing);
        }
      }

      if (holes.length > 0) {
        findings.push({
          code: 'SEQUENCE_GAP',
          severity: 'WARNING',
          message: `Faltan ${holes.length} correlativos entre A-${String(numbers[0]).padStart(5, '0')} y A-${String(numbers[numbers.length - 1]).padStart(5, '0')}`,
          entity: 'invoices',
        });
      }
    }

    // 5. El rango cruza un cierre contable.
    if (from || to) {
      const [branchCompany] = await db
        .select({ companyId: branches.companyId })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1);

      if (branchCompany) {
        const closed = await db
          .select({ year: accountingPeriods.year, month: accountingPeriods.month })
          .from(accountingPeriods)
          .where(
            and(
              eq(accountingPeriods.companyId, branchCompany.companyId),
              eq(accountingPeriods.status, 'CLOSED'),
              from ? gte(accountingPeriods.year, Number(from.slice(0, 4)) - 1) : sql`1=1`
            )
          );

        if (closed.length > 0) {
          findings.push({
            code: 'PERIOD_CLOSED',
            severity: 'WARNING',
            message: `Hay ${closed.length} período(s) cerrado(s) en el rango: verifique que el libro no cambie después del cierre`,
            entity: 'accounting_periods',
          });
        }
      }
    }

    // 6. El libro reconstruye su total.
    const book = await this.books.build(branchId, 'SALES', from, to);
    if (!book.consistent) {
      findings.push({
        code: 'BOOK_INCONSISTENT',
        severity: 'ERROR',
        message: `El libro de ventas no cuadra: base ${book.totals.base} + IVA ${book.totals.tax} + exento ${book.totals.exempt} ≠ total ${book.totals.total}`,
        entity: 'invoices',
      });
    }

    const errors = findings.filter(finding => finding.severity === 'ERROR').length;

    return {
      branchId,
      from: from ?? null,
      to: to ?? null,
      findings,
      errors,
      warnings: findings.length - errors,
      canExport: errors === 0,
    };
  }

  /** Cuenta de retenciones del período, para el resumen previo a exportar. */
  async retentionCount(branchId: string, from?: string, to?: string): Promise<number> {
    const rows = await db
      .select({ id: taxRetentions.id })
      .from(taxRetentions)
      .where(
        and(
          eq(taxRetentions.branchId, branchId),
          ...(from ? [gte(taxRetentions.date, new Date(from))] : []),
          ...(to ? [lte(taxRetentions.date, new Date(`${to.slice(0, 10)}T23:59:59.999Z`))] : [])
        )
      );

    return rows.length;
  }
}
