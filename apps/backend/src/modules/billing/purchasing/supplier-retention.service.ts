import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../database';
import { MoneyService } from '../../../common/money/money.service';
import {
  branches,
  invoices,
  partners,
  supplierRetentionSettings,
  taxRetentionLines,
  taxRetentions,
} from '../../../schema';
import { FiscalSequenceService } from '../../reports/fiscal/fiscal-sequence.service';

export type SupplierRetentionSettingsDto = {
  companyId: string;
  ivaRetentionRate: number;
  ivaRetentionRateSpecial: number;
  islrRate: number;
  islrSustraendo: number;
  islrThreshold: number;
};

export type RetentionResult = {
  /** `null` cuando la compra está exenta y no hay comprobante de IVA que emitir. */
  ivaRetentionId: string | null;
  ivaVoucherNumber: string | null;
  ivaRetained: number;
  islrRetentionId: string | null;
  islrVoucherNumber: string | null;
  islrRetained: number;
  totalRetained: number;
  /** Lo que efectivamente se le paga al proveedor: total de la factura − retenciones. */
  netPayable: number;
};

/**
 * Retenciones al proveedor al publicar una factura de compra (`T-03-03`, `T-03-04`).
 *
 * Dos impuestos y dos comprobantes:
 *
 * - **IVA**: un porcentaje del IVA de la factura (75 % ordinario, 100 % en los supuestos especiales,
 *   que dependen de la condición del proveedor).
 * - **ISLR**: porcentaje sobre la base con un sustraendo y un umbral, según el decreto vigente. Es
 *   parámetro porque cambia por año; los valores por defecto son 0 y por eso no retiene nada hasta que
 *   el negocio los cargue (⚠️ pendiente de validación).
 *
 * El número de comprobante sale de `fiscal_sequences`, por sucursal y año, sin huecos (regla 6 de
 * `S-06`). Los importes se expresan en la moneda de la factura.
 */
@Injectable()
export class SupplierRetentionService {
  constructor(
    private readonly money: MoneyService = new MoneyService(),
    private readonly sequences: FiscalSequenceService = new FiscalSequenceService()
  ) {}

  /** Empresa de la sucursal: los parámetros de retención son por empresa, no por sucursal. */
  async companyOfBranch(branchId: string): Promise<string> {
    const [branch] = await db
      .select({ companyId: branches.companyId })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);

    if (!branch) throw new NotFoundException(`Branch ${branchId} not found`);
    return branch.companyId;
  }

  async getSettings(companyId: string): Promise<SupplierRetentionSettingsDto> {
    const [existing] = await db
      .select()
      .from(supplierRetentionSettings)
      .where(eq(supplierRetentionSettings.companyId, companyId))
      .limit(1);

    if (existing) return this.toDto(existing);

    const [created] = await db
      .insert(supplierRetentionSettings)
      .values({ companyId })
      .onConflictDoNothing()
      .returning();

    if (created) return this.toDto(created);

    const [row] = await db
      .select()
      .from(supplierRetentionSettings)
      .where(eq(supplierRetentionSettings.companyId, companyId))
      .limit(1);

    if (!row) throw new NotFoundException('No se pudieron crear los parámetros de retención');
    return this.toDto(row);
  }

  async updateSettings(
    companyId: string,
    dto: Partial<Omit<SupplierRetentionSettingsDto, 'companyId'>>
  ): Promise<SupplierRetentionSettingsDto> {
    const current = await this.getSettings(companyId);

    const [updated] = await db
      .update(supplierRetentionSettings)
      .set({
        ivaRetentionRate: String(dto.ivaRetentionRate ?? current.ivaRetentionRate),
        ivaRetentionRateSpecial: String(
          dto.ivaRetentionRateSpecial ?? current.ivaRetentionRateSpecial
        ),
        islrRate: String(dto.islrRate ?? current.islrRate),
        islrSustraendo: String(dto.islrSustraendo ?? current.islrSustraendo),
        islrThreshold: String(dto.islrThreshold ?? current.islrThreshold),
        updatedAt: new Date(),
      })
      .where(eq(supplierRetentionSettings.companyId, companyId))
      .returning();

    return this.toDto(updated);
  }

  /**
   * Calcula y registra los comprobantes de retención de una factura de compra.
   * Idempotente por `(invoiceId, type)`: republicar no duplica comprobantes.
   */
  async retainInvoice(invoiceId: string, userId?: string): Promise<RetentionResult> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }
    if (invoice.type !== 'PURCHASE') {
      throw new NotFoundException('Las retenciones al proveedor sólo aplican a compras');
    }

    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, invoice.partnerId))
      .limit(1);

    const [branch] = await db
      .select({ companyId: branches.companyId })
      .from(branches)
      .where(eq(branches.id, invoice.branchId))
      .limit(1);

    if (!branch) {
      throw new NotFoundException(`Branch ${invoice.branchId} not found`);
    }

    const settings = await this.getSettings(branch.companyId);
    const year = (invoice.date ? new Date(invoice.date) : new Date()).getUTCFullYear();
    const period = `${year}-${String((invoice.date ? new Date(invoice.date) : new Date()).getUTCMonth() + 1).padStart(2, '0')}`;

    const base = Number(invoice.totalBase ?? 0);
    const tax = Number(invoice.totalTax ?? 0);
    const rate = partner?.isSpecialTaxpayer
      ? settings.ivaRetentionRateSpecial
      : settings.ivaRetentionRate;

    const ivaRetained = Number(this.money.round((tax * rate) / 100));
    const islrRetained =
      base >= settings.islrThreshold && settings.islrRate > 0
        ? Math.max(
            0,
            Number(this.money.round((base * settings.islrRate) / 100 - settings.islrSustraendo))
          )
        : 0;

    // Una compra exenta o alícuota 0 no genera comprobante: un retenido de 0 no es una obligación
    // fiscal y ensucia el correlativo.
    const iva =
      ivaRetained > 0
        ? await this.upsertRetention({
            invoice,
            type: 'IVA',
            period,
            base,
            tax,
            retained: ivaRetained,
            userId,
            companyId: branch.companyId,
            year,
          })
        : null;

    const islr =
      islrRetained > 0
        ? await this.upsertRetention({
            invoice,
            type: 'ISLR',
            period,
            base,
            tax: 0,
            retained: islrRetained,
            userId,
            companyId: branch.companyId,
            year,
          })
        : null;

    return {
      ivaRetentionId: iva?.id ?? null,
      ivaVoucherNumber: iva?.voucherNumber ?? null,
      ivaRetained,
      islrRetentionId: islr?.id ?? null,
      islrVoucherNumber: islr?.voucherNumber ?? null,
      islrRetained,
      totalRetained: Number(this.money.round(ivaRetained + islrRetained)),
      netPayable: Number(this.money.round(Number(invoice.total ?? 0) - ivaRetained - islrRetained)),
    };
  }

  private async upsertRetention(input: {
    invoice: typeof invoices.$inferSelect;
    type: 'IVA' | 'ISLR';
    period: string;
    base: number;
    tax: number;
    retained: number;
    userId?: string;
    companyId: string;
    year: number;
  }): Promise<{ id: string; voucherNumber: string }> {
    const [existing] = await db
      .select()
      .from(taxRetentions)
      .where(and(eq(taxRetentions.invoiceId, input.invoice.id), eq(taxRetentions.type, input.type)))
      .limit(1);

    if (existing) {
      return {
        id: existing.id,
        voucherNumber: existing.voucherNumber ?? existing.code,
      };
    }

    const documentType = input.type === 'IVA' ? 'RETENTION_IVA' : 'RETENTION_ISLR';
    const sequence = await this.sequences.next(input.invoice.branchId, documentType, input.year);
    const voucherNumber = this.sequences.format(documentType, input.year, sequence);

    const [created] = await db
      .insert(taxRetentions)
      .values({
        code: voucherNumber,
        partnerId: input.invoice.partnerId,
        branchId: input.invoice.branchId,
        period: input.period,
        type: input.type,
        totalBase: String(input.base),
        totalTax: String(input.tax),
        totalRetained: String(input.retained),
        totalRetainedBase: String(
          this.money.round(Number(input.invoice.exchangeRate ?? 1) * input.retained)
        ),
        currencyId: input.invoice.currencyId,
        exchangeRate: input.invoice.exchangeRate,
        invoiceId: input.invoice.id,
        voucherNumber,
        userId: input.userId ?? null,
      })
      .returning();

    await db.insert(taxRetentionLines).values({
      retentionId: created.id,
      invoiceId: input.invoice.id,
      baseAmount: String(input.base),
      taxAmount: String(input.tax),
      retainedAmount: String(input.retained),
      conceptId: null,
    });

    return { id: created.id, voucherNumber };
  }

  private toDto(row: typeof supplierRetentionSettings.$inferSelect): SupplierRetentionSettingsDto {
    return {
      companyId: row.companyId,
      ivaRetentionRate: Number(row.ivaRetentionRate),
      ivaRetentionRateSpecial: Number(row.ivaRetentionRateSpecial),
      islrRate: Number(row.islrRate),
      islrSustraendo: Number(row.islrSustraendo),
      islrThreshold: Number(row.islrThreshold),
    };
  }
}
