import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../database';
import { fiscalSequences } from '../../../schema';

/**
 * Correlativos fiscales por sucursal, documento y año (`T-06-01`).
 *
 * Regla 4 de `S-06`: la secuencia no admite huecos ni duplicados. Se reserva dentro de una
 * transacción con `pg_advisory_xact_lock`, el mismo patrón que `A-`, `PAY-` y `NOM-`: leer el máximo
 * e insertar sin lock deja que dos emisiones simultáneas tomen el mismo número.
 */
export const FISCAL_SEQUENCE_LOCK = 42005;

@Injectable()
export class FiscalSequenceService {
  async next(branchId: string, documentType: string, year: number): Promise<number> {
    return db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(${FISCAL_SEQUENCE_LOCK})`);

      const [existing] = await tx
        .select()
        .from(fiscalSequences)
        .where(
          and(
            eq(fiscalSequences.branchId, branchId),
            eq(fiscalSequences.documentType, documentType),
            eq(fiscalSequences.year, year)
          )
        )
        .limit(1);

      if (!existing) {
        const [created] = await tx
          .insert(fiscalSequences)
          .values({ branchId, documentType, year, lastNumber: 1 })
          .returning();

        return created.lastNumber;
      }

      const [updated] = await tx
        .update(fiscalSequences)
        .set({ lastNumber: existing.lastNumber + 1, updatedAt: new Date() })
        .where(eq(fiscalSequences.id, existing.id))
        .returning();

      return updated.lastNumber;
    });
  }

  /** Último número emitido, sin consumirlo. */
  async current(branchId: string, documentType: string, year: number): Promise<number> {
    const [row] = await db
      .select()
      .from(fiscalSequences)
      .where(
        and(
          eq(fiscalSequences.branchId, branchId),
          eq(fiscalSequences.documentType, documentType),
          eq(fiscalSequences.year, year)
        )
      )
      .limit(1);

    return row?.lastNumber ?? 0;
  }

  /**
   * Formato del comprobante: `RET-IVA-2026-000042`, `RET-ISLR-2026-000007` o `FIS-2026-000042`.
   *
   * El tipo va en el número porque IVA e ISLR llevan secuencias separadas: sin el prefijo, el primer
   * comprobante de ISLR del año repite el número de un comprobante de IVA (H-85).
   */
  format(documentType: string, year: number, value: number): string {
    const prefix =
      documentType === 'RETENTION_IVA'
        ? 'RET-IVA'
        : documentType === 'RETENTION_ISLR'
          ? 'RET-ISLR'
          : 'FIS';

    return `${prefix}-${year}-${String(value).padStart(6, '0')}`;
  }
}
