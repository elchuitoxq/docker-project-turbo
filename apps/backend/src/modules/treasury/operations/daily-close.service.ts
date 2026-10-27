import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../../database';
import { currencies, dailyCloses, paymentMethods, payments } from '../../../schema';
import type { DailyCloseDetailDto } from '../dto/treasury-operations.dto';

/**
 * Cierre diario de tesorería (`T-05-03`).
 *
 * Reglas de `S-05`: un día cerrado no admite pagos ni cobros nuevos (`409`), el cierre guarda un
 * snapshot inmutable (`totals`) y reabrirlo exige motivo y queda auditado.
 *
 * Un día sin fila está abierto: no hace falta crearlo antes de operar.
 */
@Injectable()
export class DailyCloseService {
  /** Rango [00:00, 23:59:59.999] del día pedido. */
  private dayRange(date: string): { start: Date; end: Date; key: string } {
    const key = this.normalizeDate(date);
    const start = new Date(`${key}T00:00:00.000`);
    const end = new Date(`${key}T23:59:59.999`);

    return { start, end, key };
  }

  normalizeDate(date: string): string {
    const key = (date ?? '').slice(0, 10);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
      Number.isNaN(new Date(`${key}T00:00:00.000`).getTime())
    ) {
      throw new BadRequestException(`Fecha inválida: ${date}. Se espera YYYY-MM-DD`);
    }

    return key;
  }

  /** `true` si el día está cerrado para esa sucursal. */
  async isClosed(branchId: string, date: string | Date): Promise<boolean> {
    const key = this.normalizeDate(
      typeof date === 'string' ? date : (date as Date).toISOString().slice(0, 10)
    );

    const [row] = await db
      .select({ id: dailyCloses.id })
      .from(dailyCloses)
      .where(
        and(
          eq(dailyCloses.branchId, branchId),
          eq(dailyCloses.date, key),
          eq(dailyCloses.status, 'CLOSED')
        )
      )
      .limit(1);

    return Boolean(row);
  }

  /** Corta la operación si el día ya se cerró (regla 1 de `S-05`). */
  async assertOpen(branchId: string, date: string | Date): Promise<void> {
    if (await this.isClosed(branchId, date)) {
      const key = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
      throw new ConflictException(
        `El cierre del ${key} está cerrado: reábrelo antes de registrar movimientos`
      );
    }
  }

  /** Totales del día; si hay cierre, devuelve el snapshot guardado. */
  async summary(branchId: string, date: string): Promise<DailyCloseDetailDto> {
    const { start, end, key } = this.dayRange(date);
    const existing = await this.findRow(branchId, key);

    if (existing?.status === 'CLOSED' && existing.totals) {
      const snapshot = existing.totals as DailyCloseDetailDto;

      return {
        ...snapshot,
        status: 'CLOSED',
        closedAt: existing.closedAt,
        closedBy: existing.closedBy,
        reopenedAt: existing.reopenedAt,
        reopenReason: existing.reopenReason,
        notes: existing.notes,
      };
    }

    const computed = await this.computeTotals(branchId, start, end);

    return {
      ...computed,
      date: key,
      status: 'OPEN',
      closedAt: existing?.closedAt ?? null,
      closedBy: existing?.closedBy ?? null,
      reopenedAt: existing?.reopenedAt ?? null,
      reopenReason: existing?.reopenReason ?? null,
      notes: existing?.notes ?? null,
    };
  }

  /**
   * Calcula los totales del día.
   *
   * Los agregados (`totalIncome`, `totalExpense`, `netBalance` y el desglose por método) van en
   * **moneda funcional**: sumar dólares con bolívares daría un número que no significa nada (H-94).
   * El desglose por moneda conserva el importe original de cada documento.
   */
  async computeTotals(
    branchId: string,
    start: Date,
    end: Date
  ): Promise<Omit<DailyCloseDetailDto, 'date' | 'status'>> {
    const rows = await db
      .select({
        type: payments.type,
        amount: payments.amount,
        amountBase: payments.amountBase,
        methodName: paymentMethods.name,
        methodCode: paymentMethods.code,
        currencyCode: currencies.code,
      })
      .from(payments)
      .leftJoin(paymentMethods, eq(paymentMethods.id, payments.methodId))
      .leftJoin(currencies, eq(currencies.id, payments.currencyId))
      .where(
        and(
          eq(payments.branchId, branchId),
          eq(payments.status, 'POSTED'),
          gte(payments.date, start),
          lte(payments.date, end)
        )
      );

    let totalIncome = 0;
    let totalExpense = 0;
    const byMethod = new Map<string, { income: number; expense: number }>();
    const byCurrency = new Map<string, { income: number; expense: number }>();

    for (const row of rows) {
      const base = Number(row.amountBase ?? row.amount ?? 0);
      const amount = Number(row.amount ?? 0);
      const isIncome = row.type === 'INCOME';

      if (isIncome) totalIncome += base;
      else totalExpense += base;

      const methodKey = row.methodName ?? row.methodCode ?? 'Sin método';
      const method = byMethod.get(methodKey) ?? { income: 0, expense: 0 };
      if (isIncome) method.income += base;
      else method.expense += base;
      byMethod.set(methodKey, method);

      const currencyKey = row.currencyCode ?? '—';
      const currency = byCurrency.get(currencyKey) ?? { income: 0, expense: 0 };
      if (isIncome) currency.income += amount;
      else currency.expense += amount;
      byCurrency.set(currencyKey, currency);
    }

    return {
      totalIncome: this.round(totalIncome),
      totalExpense: this.round(totalExpense),
      netBalance: this.round(totalIncome - totalExpense),
      cashCount: null,
      openingCash: null,
      expectedCash: null,
      difference: null,
      byPaymentMethod: [...byMethod.entries()].map(([methodName, value]) => ({
        methodName,
        income: this.round(value.income),
        expense: this.round(value.expense),
      })),
      byCurrency: [...byCurrency.entries()].map(([currencyCode, value]) => ({
        currencyCode,
        income: this.round(value.income),
        expense: this.round(value.expense),
      })),
      paymentsCount: rows.length,
    };
  }

  /** Cierra el día guardando el snapshot; `409` si ya estaba cerrado. */
  async close(
    branchId: string,
    date: string,
    userId: string | null,
    input: { notes?: string; cashCount?: number; openingCash?: number } = {}
  ): Promise<DailyCloseDetailDto> {
    const { start, end, key } = this.dayRange(date);
    const existing = await this.findRow(branchId, key);

    if (existing?.status === 'CLOSED') {
      throw new ConflictException(`El cierre del ${key} ya está cerrado`);
    }

    const totals = await this.computeTotals(branchId, start, end);
    const openingCash = Number(input.openingCash ?? 0);
    const expectedCash = this.round(openingCash + (await this.cashMovement(branchId, start, end)));
    const cashCount = input.cashCount ?? null;
    const difference = cashCount === null ? null : this.round(cashCount - expectedCash);

    const snapshot: DailyCloseDetailDto = {
      ...totals,
      date: key,
      status: 'CLOSED',
      cashCount,
      openingCash,
      expectedCash,
      difference,
      notes: input.notes ?? null,
    };

    const [saved] = existing
      ? await db
          .update(dailyCloses)
          .set({
            status: 'CLOSED',
            totals: snapshot,
            notes: input.notes ?? null,
            closedBy: userId,
            closedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(dailyCloses.id, existing.id))
          .returning()
      : await db
          .insert(dailyCloses)
          .values({
            branchId,
            date: key,
            status: 'CLOSED',
            totals: snapshot,
            notes: input.notes ?? null,
            closedBy: userId,
            closedAt: new Date(),
          })
          .returning();

    return {
      ...(saved.totals as DailyCloseDetailDto),
      status: 'CLOSED',
      closedAt: saved.closedAt,
      closedBy: saved.closedBy,
      notes: saved.notes,
    };
  }

  /** Reabre un día cerrado con motivo; queda auditado en la fila. */
  async reopen(
    branchId: string,
    date: string,
    userId: string | null,
    reason: string
  ): Promise<DailyCloseDetailDto> {
    const { key } = this.dayRange(date);

    if (!reason?.trim()) {
      throw new BadRequestException('La reapertura exige un motivo');
    }

    const existing = await this.findRow(branchId, key);

    if (!existing) {
      throw new NotFoundException(`No hay cierre registrado para el ${key}`);
    }
    if (existing.status !== 'CLOSED') {
      throw new ConflictException(`El cierre del ${key} ya está abierto`);
    }

    await db
      .update(dailyCloses)
      .set({
        status: 'OPEN',
        reopenedBy: userId,
        reopenedAt: new Date(),
        reopenReason: reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(dailyCloses.id, existing.id));

    return this.summary(branchId, key);
  }

  /** Efectivo neto del día en moneda funcional: lo que debería haber en la caja. */
  private async cashMovement(branchId: string, start: Date, end: Date): Promise<number> {
    const [row] = await db
      .select({
        income: sql<string>`coalesce(sum(case when ${payments.type} = 'INCOME' then ${payments.amountBase} else 0 end), 0)`,
        expense: sql<string>`coalesce(sum(case when ${payments.type} = 'EXPENSE' then ${payments.amountBase} else 0 end), 0)`,
      })
      .from(payments)
      .innerJoin(paymentMethods, eq(paymentMethods.id, payments.methodId))
      .where(
        and(
          eq(payments.branchId, branchId),
          eq(payments.status, 'POSTED'),
          eq(paymentMethods.isCash, true),
          gte(payments.date, start),
          lte(payments.date, end)
        )
      );

    return this.round(Number(row?.income ?? 0) - Number(row?.expense ?? 0));
  }

  private async findRow(branchId: string, key: string) {
    const [row] = await db
      .select()
      .from(dailyCloses)
      .where(and(eq(dailyCloses.branchId, branchId), eq(dailyCloses.date, key)))
      .limit(1);

    return row;
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
