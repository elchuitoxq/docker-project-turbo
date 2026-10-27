import { Injectable } from '@nestjs/common';
import { and, eq, gte, lte, asc, inArray } from 'drizzle-orm';
import { db } from '../../../database';
import { MoneyService } from '../../../common/money/money.service';
import { creditNotes, invoiceItems, invoices, partners } from '../../../schema';

export type BookType = 'SALES' | 'PURCHASES';

export type RateBucket = { rate: number; base: number; tax: number };

export type FiscalBookRow = {
  date: string;
  code: string;
  controlNumber: string | null;
  partnerTaxId: string;
  partnerName: string;
  documentType: 'INVOICE' | 'CREDIT_NOTE';
  /** Importes en moneda funcional. Una nota de crédito viene en negativo: resta. */
  total: number;
  exempt: number;
  base: number;
  tax: number;
  rate: number | null;
};

export type FiscalBook = {
  type: BookType;
  branchId: string;
  from: string | null;
  to: string | null;
  rows: FiscalBookRow[];
  totals: {
    documents: number;
    total: number;
    exempt: number;
    base: number;
    tax: number;
    byRate: RateBucket[];
  };
  /** `true` si la suma de las líneas del libro cuadra con el total de los documentos. */
  consistent: boolean;
};

/**
 * Libro de ventas y de compras (`T-06-02`).
 *
 * Tres cosas que el reporte anterior hacía mal y aquí se corrigen:
 *
 * 1. **No filtraba por sucursal**: un usuario de una sucursal veía el libro de todas (violación de
 *    R5 de `S-00`).
 * 2. **Sumaba monedas distintas**: tomaba `item.total` tal cual, así que una factura en USD entraba
 *    en el mismo total que una en bolívares. Ahora cada documento se lleva a moneda funcional con su
 *    tasa congelada (M3).
 * 3. **Ignoraba las notas de crédito**, que por regla restan.
 *
 * Sólo documentos `POSTED` (regla 1 de `S-06`).
 */
@Injectable()
export class FiscalBookService {
  constructor(private readonly money: MoneyService = new MoneyService()) {}

  async build(branchId: string, type: BookType, from?: string, to?: string): Promise<FiscalBook> {
    const rows =
      type === 'SALES'
        ? await this.salesRows(branchId, from, to)
        : await this.purchaseRows(branchId, from, to);

    const totals = {
      documents: rows.length,
      total: 0,
      exempt: 0,
      base: 0,
      tax: 0,
      byRate: [] as RateBucket[],
    };

    const buckets = new Map<number, RateBucket>();

    for (const row of rows) {
      totals.total += row.total;
      totals.exempt += row.exempt;
      totals.base += row.base;
      totals.tax += row.tax;

      if (row.rate !== null) {
        const bucket = buckets.get(row.rate) ?? { rate: row.rate, base: 0, tax: 0 };
        bucket.base += row.base;
        bucket.tax += row.tax;
        buckets.set(row.rate, bucket);
      }
    }

    totals.total = this.round(totals.total);
    totals.exempt = this.round(totals.exempt);
    totals.base = this.round(totals.base);
    totals.tax = this.round(totals.tax);
    totals.byRate = [...buckets.values()]
      .map(bucket => ({
        rate: bucket.rate,
        base: this.round(bucket.base),
        tax: this.round(bucket.tax),
      }))
      .sort((a, b) => a.rate - b.rate);

    return {
      type,
      branchId,
      from: from ?? null,
      to: to ?? null,
      rows,
      totals,
      // La base más el IVA tiene que reconstruir el total (con redondeo de 1 céntimo de tolerancia).
      consistent: Math.abs(totals.base + totals.tax + totals.exempt - totals.total) <= 0.02,
    };
  }

  /** CSV del libro, con una fila de totales al pie. */
  async toCsv(branchId: string, type: BookType, from?: string, to?: string): Promise<string> {
    const book = await this.build(branchId, type, from, to);

    const headers = [
      'Fecha',
      'Documento',
      'N° Control',
      'RIF',
      'Nombre',
      'Tipo',
      'Exento',
      'Base Imponible',
      'IVA',
      'Total',
    ];

    const lines = [headers.join('|')];

    for (const row of book.rows) {
      lines.push(
        [
          row.date,
          row.code,
          row.controlNumber ?? '',
          row.partnerTaxId,
          row.partnerName,
          row.documentType === 'CREDIT_NOTE' ? 'NOTA DE CREDITO' : 'FACTURA',
          row.exempt.toFixed(2),
          row.base.toFixed(2),
          row.tax.toFixed(2),
          row.total.toFixed(2),
        ].join('|')
      );
    }

    for (const bucket of book.totals.byRate) {
      lines.push(
        [
          '',
          `Alícuota ${bucket.rate}%`,
          '',
          '',
          '',
          '',
          '',
          bucket.base.toFixed(2),
          bucket.tax.toFixed(2),
          (bucket.base + bucket.tax).toFixed(2),
        ].join('|')
      );
    }

    lines.push(
      [
        '',
        'TOTALES',
        '',
        '',
        '',
        '',
        book.totals.exempt.toFixed(2),
        book.totals.base.toFixed(2),
        book.totals.tax.toFixed(2),
        book.totals.total.toFixed(2),
      ].join('|')
    );

    return lines.join('\n');
  }

  private async salesRows(branchId: string, from?: string, to?: string): Promise<FiscalBookRow[]> {
    const invoiceConditions = [
      eq(invoices.branchId, branchId),
      eq(invoices.status, 'POSTED'),
      eq(invoices.type, 'SALE'),
      ...this.dateConditions(from, to, 'invoice'),
    ];

    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(and(...invoiceConditions))
      .orderBy(asc(invoices.date));

    const creditNoteConditions = [
      eq(creditNotes.branchId, branchId),
      eq(creditNotes.status, 'POSTED'),
      ...this.dateConditions(from, to, 'creditNote'),
    ];

    const creditNoteRows = await db
      .select()
      .from(creditNotes)
      .where(and(...creditNoteConditions))
      .orderBy(asc(creditNotes.date));

    const rows: FiscalBookRow[] = [
      ...(await this.invoiceRows(invoiceRows, 1)),
      ...(await this.creditNoteRows(creditNoteRows, -1)),
    ];

    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }

  private async purchaseRows(
    branchId: string,
    from?: string,
    to?: string
  ): Promise<FiscalBookRow[]> {
    const conditions = [
      eq(invoices.branchId, branchId),
      eq(invoices.status, 'POSTED'),
      eq(invoices.type, 'PURCHASE'),
      ...this.dateConditions(from, to, 'invoice'),
    ];

    const purchaseRows = await db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(asc(invoices.date));

    return this.invoiceRows(purchaseRows, 1);
  }

  private dateConditions(
    from: string | undefined,
    to: string | undefined,
    table: 'invoice' | 'creditNote'
  ) {
    const column = table === 'invoice' ? invoices.date : creditNotes.date;

    return [
      ...(from ? [gte(column, new Date(from))] : []),
      ...(to ? [lte(column, new Date(`${to.slice(0, 10)}T23:59:59.999Z`))] : []),
    ];
  }

  private async invoiceRows(
    invoiceRows: Array<typeof invoices.$inferSelect>,
    sign: 1 | -1
  ): Promise<FiscalBookRow[]> {
    if (invoiceRows.length === 0) return [];

    const ids = invoiceRows.map(row => row.id);
    const items = await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, ids));
    const partnerIds = [...new Set(invoiceRows.map(row => row.partnerId))];
    const partnerRows = await db.select().from(partners).where(inArray(partners.id, partnerIds));
    const partnerById = new Map(partnerRows.map(row => [row.id, row]));

    return invoiceRows.map(invoice => {
      const rate = invoice.exchangeRate ? Number(invoice.exchangeRate) : 1;
      const itemsOfInvoice = items.filter(item => item.invoiceId === invoice.id);
      const partner = partnerById.get(invoice.partnerId);

      // Si hay líneas, el desglose por alícuota sale de ellas; si no, del encabezado.
      if (itemsOfInvoice.length > 0) {
        const taxRates = [...new Set(itemsOfInvoice.map(item => Number(item.taxRate ?? 0)))];
        const singleRate = taxRates.length === 1 ? taxRates[0] : null;

        let exempt = 0;
        let base = 0;
        let tax = 0;

        for (const item of itemsOfInvoice) {
          // `invoice_items.total` es `cantidad × precio`, **sin IVA** (ver `billing.service`).
          const lineBase = Number(item.total ?? 0) * rate;
          const itemRate = Number(item.taxRate ?? 0);

          if (itemRate === 0) {
            exempt += lineBase;
          } else {
            base += lineBase;
            tax += (lineBase * itemRate) / 100;
          }
        }

        return {
          date: this.isoDate(invoice.date),
          code: invoice.code,
          controlNumber: invoice.invoiceNumber ?? null,
          partnerTaxId: partner?.taxId ?? '',
          partnerName: partner?.name ?? '',
          documentType: 'INVOICE' as const,
          total: this.round(sign * (exempt + base + tax)),
          exempt: this.round(sign * exempt),
          base: this.round(sign * base),
          tax: this.round(sign * tax),
          rate: singleRate,
        };
      }

      const headerBase = Number(invoice.totalBase ?? 0) * rate;
      const headerTax = Number(invoice.totalTax ?? 0) * rate;

      return {
        date: this.isoDate(invoice.date),
        code: invoice.code,
        controlNumber: invoice.invoiceNumber ?? null,
        partnerTaxId: partner?.taxId ?? '',
        partnerName: partner?.name ?? '',
        documentType: 'INVOICE' as const,
        total: this.round(sign * (headerBase + headerTax)),
        exempt: 0,
        base: this.round(sign * headerBase),
        tax: this.round(sign * headerTax),
        rate: null,
      };
    });
  }

  private async creditNoteRows(
    rows: Array<typeof creditNotes.$inferSelect>,
    sign: -1
  ): Promise<FiscalBookRow[]> {
    if (rows.length === 0) return [];

    const partnerIds = [...new Set(rows.map(row => row.partnerId))];
    const partnerRows = await db.select().from(partners).where(inArray(partners.id, partnerIds));
    const partnerById = new Map(partnerRows.map(row => [row.id, row]));

    // Las notas de crédito no tienen líneas con alícuota: aportan al total, no al desglose por tasa.
    return rows.map(note => {
      const rate = note.exchangeRate ? Number(note.exchangeRate) : 1;
      const partner = partnerById.get(note.partnerId);

      return {
        date: this.isoDate(note.date),
        code: note.code,
        controlNumber: null,
        partnerTaxId: partner?.taxId ?? '',
        partnerName: partner?.name ?? '',
        documentType: 'CREDIT_NOTE' as const,
        total: this.round(sign * (Number(note.totalBase ?? 0) + Number(note.totalTax ?? 0)) * rate),
        exempt: 0,
        base: this.round(sign * Number(note.totalBase ?? 0) * rate),
        tax: this.round(sign * Number(note.totalTax ?? 0) * rate),
        rate: null,
      };
    });
  }

  private isoDate(value: Date | null): string {
    return value ? new Date(value).toISOString().slice(0, 10) : '';
  }

  private round(value: number): number {
    return Number(this.money.round(value));
  }
}
