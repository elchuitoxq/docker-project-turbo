import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../../database';
import { MoneyService } from '../../../common/money/money.service';
import { creditNotes, currencies, invoices, partners, taxRetentions } from '../../../schema';
import { computeInvoiceBalance, summarizeBalance } from './invoice-balance';

export type PayableStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export type PayableRow = {
  invoiceId: string;
  code: string;
  supplierInvoiceNumber: string | null;
  partnerId: string;
  partnerName: string;
  partnerTaxId: string;
  issueDate: string;
  dueDate: string | null;
  currencyId: string;
  currencyCode: string;
  total: number;
  paid: number;
  creditNotes: number;
  retained: number;
  balance: number;
  status: PayableStatus;
  daysOverdue: number;
};

export type AgingBucket = 'CURRENT' | 'D1_30' | 'D31_60' | 'D61_90' | 'D90_PLUS';

export type AgingReport = {
  branchId: string;
  asOf: string;
  buckets: Array<{ bucket: AgingBucket; label: string; total: number; invoices: number }>;
  byPartner: Array<{
    partnerId: string;
    partnerName: string;
    partnerTaxId: string;
    total: number;
    overdue: number;
  }>;
  totals: { balance: number; overdue: number };
};

/**
 * Cuentas por pagar (`T-03-05`).
 *
 * El saldo de una compra es `total − pagado − notas de crédito de compra`. El pagado sale de la caché
 * `invoices.paid_amount`, que escribe tesorería al asignar pagos; las notas de crédito se restan
 * aparte para que anular una NC devuelva el saldo sin tocar la caché.
 *
 * Sólo compras `POSTED`, `PARTIAL` o `PAID`: un borrador no es una obligación, pero una compra
 * pagada a medias sigue siendo exigible (H-81).
 */
@Injectable()
export class PayablesService {
  constructor(private readonly money: MoneyService = new MoneyService()) {}

  async list(
    branchId: string,
    filters: { partnerId?: string; status?: PayableStatus; asOf?: string } = {}
  ): Promise<PayableRow[]> {
    const rows = await this.build(branchId, filters.asOf);

    return rows.filter(
      row =>
        (!filters.partnerId || row.partnerId === filters.partnerId) &&
        (!filters.status || row.status === filters.status)
    );
  }

  async aging(branchId: string, asOf?: string): Promise<AgingReport> {
    const rows = await this.build(branchId, asOf);
    const cutoff = asOf ? new Date(asOf) : new Date();

    const buckets: Record<AgingBucket, { total: number; invoices: number }> = {
      CURRENT: { total: 0, invoices: 0 },
      D1_30: { total: 0, invoices: 0 },
      D31_60: { total: 0, invoices: 0 },
      D61_90: { total: 0, invoices: 0 },
      D90_PLUS: { total: 0, invoices: 0 },
    };

    const partnerTotals = new Map<
      string,
      { name: string; taxId: string; total: number; overdue: number }
    >();
    let total = 0;
    let overdue = 0;

    for (const row of rows) {
      if (row.balance <= 0) continue;

      const bucket = this.bucketFor(row.dueDate, cutoff);
      buckets[bucket].total += row.balance;
      buckets[bucket].invoices += 1;

      const partner = partnerTotals.get(row.partnerId) ?? {
        name: row.partnerName,
        taxId: row.partnerTaxId,
        total: 0,
        overdue: 0,
      };
      partner.total += row.balance;
      if (row.daysOverdue > 0) partner.overdue += row.balance;
      partnerTotals.set(row.partnerId, partner);

      total += row.balance;
      if (row.daysOverdue > 0) overdue += row.balance;
    }

    const labels: Record<AgingBucket, string> = {
      CURRENT: 'Por vencer',
      D1_30: '1 a 30 días',
      D31_60: '31 a 60 días',
      D61_90: '61 a 90 días',
      D90_PLUS: 'Más de 90 días',
    };

    return {
      branchId,
      asOf: cutoff.toISOString(),
      buckets: (Object.keys(buckets) as AgingBucket[]).map(bucket => ({
        bucket,
        label: labels[bucket],
        total: this.round(buckets[bucket].total),
        invoices: buckets[bucket].invoices,
      })),
      byPartner: [...partnerTotals.entries()]
        .map(([partnerId, value]) => ({
          partnerId,
          partnerName: value.name,
          partnerTaxId: value.taxId,
          total: this.round(value.total),
          overdue: this.round(value.overdue),
        }))
        .sort((a, b) => b.total - a.total),
      totals: { balance: this.round(total), overdue: this.round(overdue) },
    };
  }

  /** Saldo pendiente de una factura concreta (lo usa el pago para validar sobrepago). */
  async balanceOf(invoiceId: string): Promise<number> {
    const computed = await computeInvoiceBalance(invoiceId);

    return computed?.balance ?? 0;
  }

  private async build(branchId: string, asOf?: string): Promise<PayableRow[]> {
    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.branchId, branchId),
          eq(invoices.type, 'PURCHASE'),
          inArray(invoices.status, ['POSTED', 'PARTIAL', 'PAID'])
        )
      );

    if (invoiceRows.length === 0) return [];

    const ids = invoiceRows.map(row => row.id);
    const partnerIds = [...new Set(invoiceRows.map(row => row.partnerId))];

    const partnerRows = await db.select().from(partners).where(inArray(partners.id, partnerIds));
    const partnerById = new Map(partnerRows.map(row => [row.id, row]));

    const currencyIds = [...new Set(invoiceRows.map(row => row.currencyId))];
    const currencyRows = await db
      .select({ id: currencies.id, code: currencies.code })
      .from(currencies)
      .where(inArray(currencies.id, currencyIds));
    const currencyCodeById = new Map(currencyRows.map(row => [row.id, row.code]));

    const notes = await db
      .select({
        invoiceId: creditNotes.invoiceId,
        total: sql<string>`coalesce(sum(${creditNotes.total}), 0)`,
      })
      .from(creditNotes)
      .where(
        and(
          inArray(creditNotes.invoiceId, ids),
          eq(creditNotes.type, 'PURCHASE'),
          eq(creditNotes.status, 'POSTED')
        )
      )
      .groupBy(creditNotes.invoiceId);

    const notesByInvoice = new Map(notes.map(row => [row.invoiceId ?? '', Number(row.total)]));

    const retentions = await db
      .select({
        invoiceId: taxRetentions.invoiceId,
        total: sql<string>`coalesce(sum(${taxRetentions.totalRetained}), 0)`,
      })
      .from(taxRetentions)
      .where(inArray(taxRetentions.invoiceId, ids))
      .groupBy(taxRetentions.invoiceId);

    const retainedByInvoice = new Map(
      retentions.map(row => [row.invoiceId ?? '', Number(row.total)])
    );

    const cutoff = asOf ? new Date(asOf) : new Date();

    return invoiceRows.map(invoice => {
      const partner = partnerById.get(invoice.partnerId);
      const { total, paid, credited, retained, balance } = summarizeBalance({
        total: Number(invoice.total ?? 0),
        paid: Number(invoice.paidAmount ?? 0),
        credited: notesByInvoice.get(invoice.id) ?? 0,
        retained: retainedByInvoice.get(invoice.id) ?? 0,
      });
      const daysOverdue = this.daysOverdue(invoice.dueDate, cutoff);

      return {
        invoiceId: invoice.id,
        code: invoice.code,
        supplierInvoiceNumber: invoice.supplierInvoiceNumber ?? null,
        partnerId: invoice.partnerId,
        partnerName: partner?.name ?? '',
        partnerTaxId: partner?.taxId ?? '',
        issueDate: invoice.date ? new Date(invoice.date).toISOString().slice(0, 10) : '',
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : null,
        currencyId: invoice.currencyId,
        currencyCode: currencyCodeById.get(invoice.currencyId) ?? '',
        total,
        paid,
        creditNotes: credited,
        retained,
        balance,
        status: this.statusFor(balance, paid + credited, daysOverdue),
        daysOverdue,
      };
    });
  }

  private statusFor(balance: number, covered: number, daysOverdue: number): PayableStatus {
    if (balance <= 0.01) return 'PAID';
    if (daysOverdue > 0) return 'OVERDUE';
    // La retención no "paga" la factura: sólo cuentan el efectivo y las notas de crédito.
    if (covered > 0.01) return 'PARTIAL';
    return 'PENDING';
  }

  private daysOverdue(dueDate: Date | null, cutoff: Date): number {
    if (!dueDate) return 0;

    const due = new Date(dueDate).getTime();
    const diff = Math.floor((cutoff.getTime() - due) / (24 * 60 * 60 * 1000));

    return diff > 0 ? diff : 0;
  }

  private bucketFor(dueDate: string | null, cutoff: Date): AgingBucket {
    if (!dueDate) return 'CURRENT';

    const days = this.daysOverdue(new Date(dueDate), cutoff);

    if (days === 0) return 'CURRENT';
    if (days <= 30) return 'D1_30';
    if (days <= 60) return 'D31_60';
    if (days <= 90) return 'D61_90';
    return 'D90_PLUS';
  }

  private round(value: number): number {
    return Number(this.money.round(value));
  }
}
