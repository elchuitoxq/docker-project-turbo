import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../../database';
import { fiscalExports } from '../../../schema';
import { FiscalBookService } from './fiscal-book.service';
import { FiscalSequenceService } from './fiscal-sequence.service';
import { FiscalValidationService } from './fiscal-validation.service';

export type FiscalReportType =
  'LIBRO_VENTAS' | 'LIBRO_COMPRAS' | 'RETENCIONES_IVA' | 'RETENCIONES_ISLR';
export type FiscalFormat = 'CSV' | 'TXT' | 'XML';

export type FiscalExportResult = {
  id: string;
  code: string;
  reportType: FiscalReportType;
  format: FiscalFormat;
  sequenceNumber: number;
  hash: string;
  sizeBytes: number;
  generatedAt: string;
  content: string;
  /** Advertencias de la validación: no bloquean, pero quedan a la vista. */
  warnings: string[];
};

/**
 * Exportación fiscal registrada (`T-06-05`).
 *
 * Cada archivo generado se guarda con su hash —la trazabilidad que pide la regla 5 de `S-06`— y con
 * un correlativo por sucursal, tipo y año. Si la validación devuelve **errores** no se genera archivo:
 * `409` con el detalle (regla 4 y criterio "exportación bloqueada por validación").
 */
@Injectable()
export class FiscalExportService {
  constructor(
    private readonly books: FiscalBookService = new FiscalBookService(),
    private readonly sequences: FiscalSequenceService = new FiscalSequenceService(),
    private readonly validation: FiscalValidationService = new FiscalValidationService()
  ) {}

  async export(input: {
    branchId: string;
    reportType: FiscalReportType;
    format: FiscalFormat;
    from?: string;
    to?: string;
    userId?: string;
    /** Contenido ya renderizado (por ejemplo el TXT de retenciones que arma ReportsService). */
    content?: string;
  }): Promise<FiscalExportResult> {
    const { branchId, reportType, format, from, to, userId } = input;

    const check = await this.validation.validate(branchId, from, to);
    if (!check.canExport) {
      throw new ConflictException({
        message: 'La exportación está bloqueada por hallazgos fiscales',
        findings: check.findings.filter(finding => finding.severity === 'ERROR'),
      });
    }

    const content = input.content ?? (await this.render(branchId, reportType, format, from, to));
    const hash = createHash('sha256').update(content, 'utf8').digest('hex');
    const year = to ? Number(to.slice(0, 4)) : new Date().getUTCFullYear();

    const sequenceNumber = await this.sequences.next(branchId, reportType, year);
    const code = this.sequences.format(reportType, year, sequenceNumber);

    const [saved] = await db
      .insert(fiscalExports)
      .values({
        branchId,
        reportType,
        format,
        periodFrom: from ? new Date(from) : null,
        periodTo: to ? new Date(`${to.slice(0, 10)}T23:59:59.999Z`) : null,
        sequenceNumber,
        hash,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        userId: userId ?? null,
      })
      .returning();

    return {
      id: saved.id,
      code,
      reportType,
      format,
      sequenceNumber,
      hash,
      sizeBytes: saved.sizeBytes ?? 0,
      generatedAt: (saved.createdAt ?? new Date()).toISOString(),
      content,
      warnings: check.findings
        .filter(finding => finding.severity === 'WARNING')
        .map(finding => finding.message),
    };
  }

  async history(branchId: string): Promise<Array<typeof fiscalExports.$inferSelect>> {
    return db.select().from(fiscalExports).where(eq(fiscalExports.branchId, branchId));
  }

  private async render(
    branchId: string,
    reportType: FiscalReportType,
    format: FiscalFormat,
    from?: string,
    to?: string
  ): Promise<string> {
    if (reportType === 'LIBRO_VENTAS') {
      return this.books.toCsv(branchId, 'SALES', from, to);
    }
    if (reportType === 'LIBRO_COMPRAS') {
      return this.books.toCsv(branchId, 'PURCHASES', from, to);
    }

    // Las retenciones se renderizan en `ReportsService` (TXT SENIAT / XML del comprobante) y llegan
    // ya armadas en `content`; si no, se deja un aviso explícito en lugar de un archivo vacío.
    return `# ${reportType} ${format}: sin generador directo, use el endpoint de retenciones`;
  }
}
