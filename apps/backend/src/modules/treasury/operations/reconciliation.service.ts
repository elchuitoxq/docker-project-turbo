import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import { db } from '../../../database';
import { bankAccounts, bankStatementImports, bankStatementLines, payments } from '../../../schema';
import type {
  ImportStatementDto,
  ReconciliationReportDto,
  StatementLineDto,
} from '../dto/treasury-operations.dto';
import { DailyCloseService } from './daily-close.service';

/**
 * Conciliación bancaria (`T-05-04`, `T-05-05`).
 *
 * El extracto se importa como CSV genérico (`fecha,monto,referencia,descripción`) y se guarda con el
 * hash del archivo: reimportar el mismo extracto no duplica líneas (regla 4 de `S-05`). Cada línea se
 * concilia con **un** pago y el pago con **una** línea; el índice único parcial lo garantiza en base.
 */
@Injectable()
export class ReconciliationService {
  constructor(private readonly dailyClose: DailyCloseService = new DailyCloseService()) {}

  /** Importa un CSV; devuelve la cabecera creada y las líneas. */
  async importCsv(
    branchId: string,
    userId: string | null,
    dto: ImportStatementDto
  ): Promise<{ importId: string; linesCount: number; duplicated: boolean }> {
    const [account] = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, dto.bankAccountId))
      .limit(1);

    if (!account || (account.branchId && account.branchId !== branchId)) {
      throw new NotFoundException(`Cuenta bancaria ${dto.bankAccountId} no encontrada`);
    }

    const rows = this.parseCsv(dto.content);
    if (rows.length === 0) {
      throw new BadRequestException(
        'El extracto no tiene líneas válidas. Formato: fecha,monto,referencia,descripción'
      );
    }

    const fileHash = createHash('sha256').update(dto.content).digest('hex');

    const [existing] = await db
      .select()
      .from(bankStatementImports)
      .where(
        and(
          eq(bankStatementImports.bankAccountId, dto.bankAccountId),
          eq(bankStatementImports.fileHash, fileHash)
        )
      )
      .limit(1);

    if (existing) {
      return { importId: existing.id, linesCount: existing.linesCount, duplicated: true };
    }

    const importId = await db.transaction(async tx => {
      const [header] = await tx
        .insert(bankStatementImports)
        .values({
          bankAccountId: dto.bankAccountId,
          branchId,
          fileHash,
          fileName: dto.fileName ?? null,
          linesCount: rows.length,
          importedBy: userId,
        })
        .returning();

      await tx.insert(bankStatementLines).values(
        rows.map(row => ({
          importId: header.id,
          bankAccountId: dto.bankAccountId,
          branchId,
          date: row.date,
          amount: String(row.amount),
          direction: row.amount < 0 ? 'OUT' : 'IN',
          reference: row.reference ?? null,
          description: row.description ?? null,
        }))
      );

      return header.id;
    });

    return { importId, linesCount: rows.length, duplicated: false };
  }

  /**
   * Estado de conciliación de una cuenta en un rango.
   *
   * Las líneas pendientes traen sugerencias por monto y fecha (±3 días), que es lo que pide el
   * criterio de `S-05` para no conciliar a ciegas.
   */
  async report(
    branchId: string,
    bankAccountId: string,
    range: { from?: string; to?: string } = {}
  ): Promise<ReconciliationReportDto> {
    const [account] = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, bankAccountId))
      .limit(1);

    if (!account || (account.branchId && account.branchId !== branchId)) {
      throw new NotFoundException(`Cuenta bancaria ${bankAccountId} no encontrada`);
    }

    const lineConditions = [
      eq(bankStatementLines.bankAccountId, bankAccountId),
      eq(bankStatementLines.branchId, branchId),
    ];
    if (range.from) lineConditions.push(gte(bankStatementLines.date, range.from.slice(0, 10)));
    if (range.to) lineConditions.push(lte(bankStatementLines.date, range.to.slice(0, 10)));

    const lines = await db
      .select()
      .from(bankStatementLines)
      .where(and(...lineConditions))
      .orderBy(desc(bankStatementLines.date));

    const paymentConditions = [eq(payments.branchId, branchId), eq(payments.status, 'POSTED')];
    if (account.branchId) paymentConditions.push(eq(payments.bankAccountId, bankAccountId));
    if (range.from)
      paymentConditions.push(
        gte(payments.date, new Date(`${range.from.slice(0, 10)}T00:00:00.000`))
      );
    if (range.to)
      paymentConditions.push(lte(payments.date, new Date(`${range.to.slice(0, 10)}T23:59:59.999`)));

    const candidatePayments = await db
      .select({
        id: payments.id,
        code: payments.code,
        amount: payments.amount,
        date: payments.date,
        direction: payments.direction,
        bankStatementLineId: payments.bankStatementLineId,
      })
      .from(payments)
      .where(and(...paymentConditions));

    const matchedLineIds = new Set(
      candidatePayments
        .map(payment => payment.bankStatementLineId)
        .filter((id): id is string => Boolean(id))
    );

    const dtos: StatementLineDto[] = lines.map(line => {
      const sameAmount = candidatePayments.filter(
        payment =>
          !payment.bankStatementLineId &&
          Math.abs(Number(payment.amount) - Math.abs(Number(line.amount))) < 0.01 &&
          this.daysBetween(
            new Date(payment.date ?? new Date()),
            new Date(`${line.date}T00:00:00.000`)
          ) <= 3
      );

      return {
        id: line.id,
        date: line.date,
        amount: Number(line.amount),
        direction: line.direction as 'IN' | 'OUT',
        reference: line.reference,
        description: line.description,
        matchedPaymentId: line.matchedPaymentId,
        matched: Boolean(line.matchedPaymentId),
        suggestions: sameAmount.slice(0, 5).map(payment => ({
          paymentId: payment.id,
          code: payment.code,
          amount: Number(payment.amount),
          date: new Date(payment.date ?? new Date()).toISOString().slice(0, 10),
        })),
      };
    });

    return {
      bankAccountId,
      totalLines: dtos.length,
      matchedLines: dtos.filter(line => line.matched).length,
      lines: dtos,
      unmatchedPayments: candidatePayments
        .filter(payment => !payment.bankStatementLineId)
        .filter(payment => !matchedLineIds.has(payment.id))
        .map(payment => ({
          paymentId: payment.id,
          code: payment.code,
          amount: Number(payment.amount),
          date: new Date(payment.date ?? new Date()).toISOString().slice(0, 10),
        })),
    };
  }

  /** Concilia una línea con un pago. Idempotente si ya estaban vinculados. */
  async match(
    branchId: string,
    lineId: string,
    paymentId: string,
    userId: string | null
  ): Promise<StatementLineDto> {
    const [line] = await db
      .select()
      .from(bankStatementLines)
      .where(eq(bankStatementLines.id, lineId))
      .limit(1);

    if (!line || line.branchId !== branchId) {
      throw new NotFoundException(`Línea de extracto ${lineId} no encontrada`);
    }

    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);

    if (!payment || payment.branchId !== branchId) {
      throw new NotFoundException(`Pago ${paymentId} no encontrado`);
    }
    if (payment.status !== 'POSTED') {
      throw new BadRequestException('Sólo se concilian pagos registrados');
    }
    if (line.matchedPaymentId === paymentId) {
      return this.toDto(line);
    }
    if (line.matchedPaymentId) {
      throw new ConflictException('La línea ya está conciliada con otro pago');
    }
    if (payment.bankStatementLineId && payment.bankStatementLineId !== lineId) {
      throw new ConflictException('El pago ya está conciliado con otra línea');
    }

    await this.dailyClose.assertOpen(branchId, line.date);

    await db.transaction(async tx => {
      await tx
        .update(bankStatementLines)
        .set({ matchedPaymentId: paymentId, matchedAt: new Date(), matchedBy: userId })
        .where(eq(bankStatementLines.id, lineId));

      await tx
        .update(payments)
        .set({ bankStatementLineId: lineId })
        .where(eq(payments.id, paymentId));
    });

    const [updated] = await db
      .select()
      .from(bankStatementLines)
      .where(eq(bankStatementLines.id, lineId))
      .limit(1);

    return this.toDto(updated);
  }

  /** Deshace la conciliación; queda auditado en el pago y en la línea. */
  async unmatch(branchId: string, lineId: string): Promise<StatementLineDto> {
    const [line] = await db
      .select()
      .from(bankStatementLines)
      .where(eq(bankStatementLines.id, lineId))
      .limit(1);

    if (!line || line.branchId !== branchId) {
      throw new NotFoundException(`Línea de extracto ${lineId} no encontrada`);
    }
    if (!line.matchedPaymentId) {
      throw new BadRequestException('La línea no está conciliada');
    }

    await this.dailyClose.assertOpen(branchId, line.date);

    await db.transaction(async tx => {
      await tx
        .update(payments)
        .set({ bankStatementLineId: null })
        .where(eq(payments.id, line.matchedPaymentId as string));

      await tx
        .update(bankStatementLines)
        .set({ matchedPaymentId: null, matchedAt: null, matchedBy: null })
        .where(eq(bankStatementLines.id, lineId));
    });

    const [updated] = await db
      .select()
      .from(bankStatementLines)
      .where(eq(bankStatementLines.id, lineId))
      .limit(1);

    return this.toDto(updated);
  }

  /**
   * Parser del CSV genérico.
   *
   * Acepta `;` o `,` como separador, ignora la cabecera y las líneas vacías, y exige fecha ISO y
   * monto numérico: si una fila no cumple, se informa la línea en lugar de importar a medias.
   */
  parseCsv(content: string): Array<{
    date: string;
    amount: number;
    reference?: string;
    description?: string;
  }> {
    const rows: Array<{ date: string; amount: number; reference?: string; description?: string }> =
      [];
    const lines = (content ?? '').split(/\r?\n/);

    lines.forEach((raw, index) => {
      const line = raw.trim();
      if (!line) return;

      const separator = line.includes(';') ? ';' : ',';
      const cells = this.splitCsvLine(line, separator);

      const [dateCell, amountCell, reference, ...rest] = cells;
      // Sólo la primera fila puede ser cabecera: descartar filas por "parecer cabecera" perdería
      // líneas reales en silencio.
      if (index === 0 && /^(fecha|date)\b/i.test(dateCell)) return;

      const date = dateCell.slice(0, 10);
      const amount = this.parseAmount(amountCell);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(amount)) {
        throw new BadRequestException(
          `Línea ${index + 1} inválida: "${line}". Se espera YYYY-MM-DD,monto,referencia,descripción`
        );
      }

      rows.push({ date, amount, reference, description: rest.join(' ') || undefined });
    });

    return rows;
  }

  /** Divide una línea respetando comillas: `"1.234,56"` es un solo campo. */
  private splitCsvLine(line: string, separator: string): string[] {
    const cells: string[] = [];
    let current = '';
    let quoted = false;

    for (const char of line) {
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (char === separator && !quoted) {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }

    cells.push(current.trim());

    return cells;
  }

  /**
   * Importe del extracto en formato inglés o español.
   *
   * `500.00` es quinientos y `1.234,56` es mil doscientos treinta y cuatro con cincuenta y seis:
   * borrar todos los puntos convertiría el primero en cincuenta mil (H-93).
   */
  private parseAmount(raw: string): number {
    const value = (raw ?? '').trim().replace(/\s/g, '');

    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) {
      return Number(value.replace(/\./g, '').replace(',', '.'));
    }
    if (/^-?\d+([.,]\d+)?$/.test(value)) {
      return Number(value.replace(',', '.'));
    }

    return Number.NaN;
  }

  private toDto(line: typeof bankStatementLines.$inferSelect): StatementLineDto {
    return {
      id: line.id,
      date: line.date,
      amount: Number(line.amount),
      direction: line.direction as 'IN' | 'OUT',
      reference: line.reference,
      description: line.description,
      matchedPaymentId: line.matchedPaymentId,
      matched: Boolean(line.matchedPaymentId),
    };
  }

  private daysBetween(a: Date, b: Date): number {
    return Math.abs(Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)));
  }
}
