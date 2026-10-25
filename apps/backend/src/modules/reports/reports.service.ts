import { Injectable } from '@nestjs/common';
import { db } from '../../database';
import {
  taxRetentions,
  taxRetentionLines,
  invoices,
  invoiceItems,
  partners,
  creditNotes,
  branches,
  companies,
} from '../../schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

interface DateRangeParams {
  dateFrom?: string;
  dateTo?: string;
}

interface RetencionIvaLine {
  rif: string;
  fecha: string;
  numeroComprobante: string;
  montoTotal: number;
  montoImpuesto: number;
  codigo: string;
}

interface RetencionIslrLine {
  rif: string;
  nombre: string;
  periodo: string;
  totalBase: number;
  totalRetenido: number;
  invoices: Array<{
    numero: string;
    fecha: string;
    montoBase: number;
    montoRetenido: number;
    concepto: string;
  }>;
}

export interface FiscalSummary {
  totalInvoices: number;
  totalCreditNotes: number;
  totalRetencionesIva: number;
  totalRetencionesIslr: number;
  totalBaseImponible: number;
  totalIva: number;
  totalIgtf: number;
  totalCreditNotesAmount: number;
  dateFrom: string;
  dateTo: string;
}

interface LibroVentasLine {
  fecha: string;
  nroFactura: string;
  nroControl: string;
  rifCliente: string;
  nombreCliente: string;
  total: number;
  exento: number;
  baseImponible: number;
  iva: number;
  ivaGeneral: number;
  ivaRediducido: number;
  ivaAdicional: number;
}

interface LibroComprasLine {
  fecha: string;
  nroFactura: string;
  nroControl: string;
  rifProveedor: string;
  nombreProveedor: string;
  total: number;
  exento: number;
  baseImponible: number;
  iva: number;
  ivaGeneral: number;
  ivaRediducido: number;
  ivaAdicional: number;
  retencionIva: number;
  nroComprobante: string;
}

@Injectable()
export class ReportsService {
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateForSeniat(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private parseNumeric(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    return parseFloat(String(value)) || 0;
  }

  private buildDateConditions(dateFrom?: string, dateTo?: string) {
    const conditions = [];
    if (dateFrom) {
      conditions.push(gte(taxRetentions.date, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(taxRetentions.date, new Date(dateTo + 'T23:59:59')));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private buildInvoiceDateConditions(dateFrom?: string, dateTo?: string) {
    const conditions = [];
    if (dateFrom) {
      conditions.push(gte(invoices.date, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(invoices.date, new Date(dateTo + 'T23:59:59')));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async getRetencionesIvaTxt(dateFrom?: string, dateTo?: string): Promise<string> {
    const conditions = [
      eq(taxRetentions.type, 'IVA'),
      ...(dateFrom ? [gte(taxRetentions.date, new Date(dateFrom))] : []),
      ...(dateTo ? [lte(taxRetentions.date, new Date(dateTo + 'T23:59:59'))] : []),
    ];

    const retenciones = await db
      .select()
      .from(taxRetentions)
      .where(and(...conditions));

    const lines: string[] = [];

    for (const ret of retenciones) {
      const [partner] = await db
        .select()
        .from(partners)
        .where(eq(partners.id, ret.partnerId))
        .limit(1);

      const retentionLines = await db
        .select()
        .from(taxRetentionLines)
        .where(eq(taxRetentionLines.retentionId, ret.id));

      let totalMontoTotal = 0;
      let totalMontoImpuesto = 0;

      for (const line of retentionLines) {
        totalMontoTotal += this.parseNumeric(line.baseAmount);
        totalMontoImpuesto += this.parseNumeric(line.retainedAmount);
      }

      const rif = partner?.taxId || '';
      const fecha = ret.date ? this.formatDateForSeniat(new Date(ret.date)) : '';
      const numeroComprobante = ret.code;
      const montoTotal = totalMontoTotal.toFixed(2);
      const montoImpuesto = totalMontoImpuesto.toFixed(2);
      const codigo = ret.period || '';

      lines.push(`${rif}|${fecha}|${numeroComprobante}|${montoTotal}|${montoImpuesto}|${codigo}|`);
    }

    return lines.join('\n');
  }

  async getRetencionesIslrXml(dateFrom?: string, dateTo?: string): Promise<string> {
    const conditions = [
      eq(taxRetentions.type, 'ISLR'),
      ...(dateFrom ? [gte(taxRetentions.date, new Date(dateFrom))] : []),
      ...(dateTo ? [lte(taxRetentions.date, new Date(dateTo + 'T23:59:59'))] : []),
    ];

    const retenciones = await db
      .select()
      .from(taxRetentions)
      .where(and(...conditions));

    const [company] = await db
      .select({ taxId: companies.taxId, name: companies.name })
      .from(branches)
      .innerJoin(companies, eq(branches.companyId, companies.id))
      .limit(1);
    const companyRif = company?.taxId || 'J-000000000';
    const companyName = company?.name || 'Empresa';

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<RelacionRetencionesISLR>\n';
    xml += '  <Cabecera>\n';
    xml += `    <RifAgente>${companyRif}</RifAgente>\n`;
    xml += `    <NombreRazonSocial>${companyName}</NombreRazonSocial>\n`;
    xml += `    <Periodo>${dateFrom || 'N/A'} - ${dateTo || 'N/A'}</Periodo>\n`;
    xml += '  </Cabecera>\n';
    xml += '  <Detalle>\n';

    for (const ret of retenciones) {
      const [partner] = await db
        .select()
        .from(partners)
        .where(eq(partners.id, ret.partnerId))
        .limit(1);

      const retentionLines = await db
        .select()
        .from(taxRetentionLines)
        .where(eq(taxRetentionLines.retentionId, ret.id));

      const rif = partner?.taxId || '';
      const nombre = partner?.name || '';

      for (const line of retentionLines) {
        const invoiceData = line.invoiceId
          ? await db.select().from(invoices).where(eq(invoices.id, line.invoiceId)).limit(1)
          : [];

        const invoice = invoiceData[0];
        const fecha = invoice?.date ? this.formatDateForSeniat(new Date(invoice.date)) : (ret.date ? this.formatDateForSeniat(new Date(ret.date)) : '');
        const numero = invoice?.code || ret.code;
        const montoBase = this.parseNumeric(line.baseAmount).toFixed(2);
        const montoRetenido = this.parseNumeric(line.retainedAmount).toFixed(2);
        const concepto = line.conceptId || 'GEN';

        xml += '    <Retencion>\n';
        xml += `      <RifRetenido>${rif}</RifRetenido>\n`;
        xml += `      <NombreRetenido>${nombre}</NombreRetenido>\n`;
        xml += `      <NumeroFactura>${numero}</NumeroFactura>\n`;
        xml += `      <FechaFactura>${fecha}</FechaFactura>\n`;
        xml += `      <MontoBase>${montoBase}</MontoBase>\n`;
        xml += `      <MontoRetenido>${montoRetenido}</MontoRetenido>\n`;
        xml += `      <Concepto>${concepto}</Concepto>\n`;
        xml += '    </Retencion>\n';
      }
    }

    xml += '  </Detalle>\n';
    xml += '</RelacionRetencionesISLR>';

    return xml;
  }

  async getFiscalSummary(dateFrom?: string, dateTo?: string): Promise<FiscalSummary> {
    const invoiceConditions = this.buildInvoiceDateConditions(dateFrom, dateTo);
    const retentionConditions = this.buildDateConditions(dateFrom, dateTo);

    const allInvoices = invoiceConditions
      ? await db.select().from(invoices).where(invoiceConditions)
      : await db.select().from(invoices);

    const allRetencionesIva = retentionConditions
      ? await db.select().from(taxRetentions).where(
          and(retentionConditions, eq(taxRetentions.type, 'IVA'))
        )
      : await db
          .select()
          .from(taxRetentions)
          .where(eq(taxRetentions.type, 'IVA'));

    const allRetencionesIslr = retentionConditions
      ? await db.select().from(taxRetentions).where(
          and(retentionConditions, eq(taxRetentions.type, 'ISLR'))
        )
      : await db
          .select()
          .from(taxRetentions)
          .where(eq(taxRetentions.type, 'ISLR'));

    const allCreditNotes = invoiceConditions
      ? await db.select().from(creditNotes).where(invoiceConditions)
      : await db.select().from(creditNotes);

    let totalBaseImponible = 0;
    let totalIva = 0;
    let totalIgtf = 0;
    let totalRetencionesIva = 0;
    let totalRetencionesIslr = 0;

    for (const inv of allInvoices) {
      totalBaseImponible += this.parseNumeric(inv.totalBase);
      totalIva += this.parseNumeric(inv.totalTax);
      totalIgtf += this.parseNumeric(inv.totalIgtf);
    }

    for (const ret of allRetencionesIva) {
      totalRetencionesIva += this.parseNumeric(ret.totalRetained);
    }

    for (const ret of allRetencionesIslr) {
      totalRetencionesIslr += this.parseNumeric(ret.totalRetained);
    }

    let totalCreditNotesAmount = 0;
    for (const cn of allCreditNotes) {
      totalCreditNotesAmount += this.parseNumeric(cn.total);
    }

    return {
      totalInvoices: allInvoices.length,
      totalCreditNotes: allCreditNotes.length,
      totalRetencionesIva,
      totalRetencionesIslr,
      totalBaseImponible: Math.round(totalBaseImponible * 100) / 100,
      totalIva: Math.round(totalIva * 100) / 100,
      totalIgtf: Math.round(totalIgtf * 100) / 100,
      totalCreditNotesAmount: Math.round(totalCreditNotesAmount * 100) / 100,
      dateFrom: dateFrom || 'N/A',
      dateTo: dateTo || 'N/A',
    };
  }

  async getLibroVentas(dateFrom?: string, dateTo?: string): Promise<string> {
    const conditions = [
      eq(invoices.status, 'POSTED'),
      ...(dateFrom ? [gte(invoices.date, new Date(dateFrom))] : []),
      ...(dateTo ? [lte(invoices.date, new Date(dateTo + 'T23:59:59'))] : []),
    ];

    const allInvoices = await db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.date));

    const lines: string[] = [];
    const headers = [
      'Fecha',
      'N° Factura',
      'N° Control',
      'RifCliente',
      'Nombre',
      'Total',
      'Exento',
      'Base Imponible',
      'IVA',
      'IVA General',
      'IVA Reducido',
      'IVA Adicional',
    ];
    lines.push(headers.join('|'));

    for (const inv of allInvoices) {
      const [partner] = await db
        .select()
        .from(partners)
        .where(eq(partners.id, inv.partnerId))
        .limit(1);

      const invoiceItemsList = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, inv.id));

      let exento = 0;
      let baseGeneral = 0;
      let baseReducido = 0;
      let baseAdicional = 0;
      let ivaGeneral = 0;
      let ivaReducido = 0;
      let ivaAdicional = 0;

      for (const item of invoiceItemsList) {
        const taxRate = this.parseNumeric(item.taxRate);
        const totalItem = this.parseNumeric(item.total);

        if (taxRate === 0) {
          exento += totalItem;
        } else if (taxRate === 16) {
          baseGeneral += totalItem;
          ivaGeneral += totalItem * 0.16;
        } else if (taxRate === 8) {
          baseReducido += totalItem;
          ivaReducido += totalItem * 0.08;
        } else {
          baseAdicional += totalItem;
          ivaAdicional += totalItem * (taxRate / 100);
        }
      }

      const fecha = inv.date ? this.formatDate(new Date(inv.date)) : '';
      const nroFactura = inv.code;
      const nroControl = inv.invoiceNumber || '';
      const rifCliente = partner?.taxId || '';
      const nombreCliente = partner?.name || '';
      const total = this.parseNumeric(inv.total).toFixed(2);
      const exentoStr = exento.toFixed(2);
      const baseImponible = (baseGeneral + baseReducido + baseAdicional).toFixed(2);
      const iva = (ivaGeneral + ivaReducido + ivaAdicional).toFixed(2);
      const ivaGenStr = ivaGeneral.toFixed(2);
      const ivaRedStr = ivaReducido.toFixed(2);
      const ivaAdcStr = ivaAdicional.toFixed(2);

      lines.push(
        `${fecha}|${nroFactura}|${nroControl}|${rifCliente}|${nombreCliente}|${total}|${exentoStr}|${baseImponible}|${iva}|${ivaGenStr}|${ivaRedStr}|${ivaAdcStr}`
      );
    }

    return lines.join('\n');
  }

  async getLibroCompras(dateFrom?: string, dateTo?: string): Promise<string> {
    const conditions = [
      eq(invoices.type, 'PURCHASE'),
      ...(dateFrom ? [gte(invoices.date, new Date(dateFrom))] : []),
      ...(dateTo ? [lte(invoices.date, new Date(dateTo + 'T23:59:59'))] : []),
    ];

    const allInvoices = await db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.date));

    const lines: string[] = [];
    const headers = [
      'Fecha',
      'N° Factura',
      'N° Control',
      'RifProveedor',
      'Nombre',
      'Total',
      'Exento',
      'Base Imponible',
      'IVA',
      'IVA General',
      'IVA Reducido',
      'IVA Adicional',
      'Retencion IVA',
      'N° Comprobante',
    ];
    lines.push(headers.join('|'));

    for (const inv of allInvoices) {
      const [partner] = await db
        .select()
        .from(partners)
        .where(eq(partners.id, inv.partnerId))
        .limit(1);

      const invoiceItemsList = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, inv.id));

      const retencionesIva = await db
        .select()
        .from(taxRetentions)
        .where(and(
          eq(taxRetentions.partnerId, inv.partnerId),
          eq(taxRetentions.type, 'IVA')
        ));

      let retencionIva = 0;
      let nroComprobante = '';
      for (const ret of retencionesIva) {
        if (ret.date && inv.date) {
          const retDate = new Date(ret.date);
          const invDate = new Date(inv.date);
          if (retDate >= invDate && retDate <= new Date(invDate.getTime() + 30 * 24 * 60 * 60 * 1000)) {
            retencionIva += this.parseNumeric(ret.totalRetained);
            nroComprobante = ret.code;
          }
        }
      }

      let exento = 0;
      let baseGeneral = 0;
      let baseReducido = 0;
      let baseAdicional = 0;
      let ivaGeneral = 0;
      let ivaReducido = 0;
      let ivaAdicional = 0;

      for (const item of invoiceItemsList) {
        const taxRate = this.parseNumeric(item.taxRate);
        const totalItem = this.parseNumeric(item.total);

        if (taxRate === 0) {
          exento += totalItem;
        } else if (taxRate === 16) {
          baseGeneral += totalItem;
          ivaGeneral += totalItem * 0.16;
        } else if (taxRate === 8) {
          baseReducido += totalItem;
          ivaReducido += totalItem * 0.08;
        } else {
          baseAdicional += totalItem;
          ivaAdicional += totalItem * (taxRate / 100);
        }
      }

      const fecha = inv.date ? this.formatDate(new Date(inv.date)) : '';
      const nroFactura = inv.code;
      const nroControl = inv.invoiceNumber || '';
      const rifProveedor = partner?.taxId || '';
      const nombreProveedor = partner?.name || '';
      const total = this.parseNumeric(inv.total).toFixed(2);
      const exentoStr = exento.toFixed(2);
      const baseImponible = (baseGeneral + baseReducido + baseAdicional).toFixed(2);
      const iva = (ivaGeneral + ivaReducido + ivaAdicional).toFixed(2);
      const ivaGenStr = ivaGeneral.toFixed(2);
      const ivaRedStr = ivaReducido.toFixed(2);
      const ivaAdcStr = ivaAdicional.toFixed(2);
      const retIvaStr = retencionIva.toFixed(2);

      lines.push(
        `${fecha}|${nroFactura}|${nroControl}|${rifProveedor}|${nombreProveedor}|${total}|${exentoStr}|${baseImponible}|${iva}|${ivaGenStr}|${ivaRedStr}|${ivaAdcStr}|${retIvaStr}|${nroComprobante}`
      );
    }

    return lines.join('\n');
  }
}
