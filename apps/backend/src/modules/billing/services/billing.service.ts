import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '../../../database';
import { invoices, invoiceItems, partners, currencies, exchangeRates, products } from '../../../schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceResponseDto,
  InvoiceStatsDto,
  InvoiceStatus,
  InvoiceItemResponseDto,
  FiscalJsonDto,
} from '../dto/billing.dto';

const IVA_RATE = 0.16;
const IGTF_RATE = 0.03;

@Injectable()
export class BillingService {
  private async getNextInvoiceCode(branchId: string): Promise<string> {
    const lastInvoice = await db
      .select({ code: invoices.code })
      .from(invoices)
      .where(eq(invoices.branchId, branchId))
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    let nextNumber = 1;
    if (lastInvoice.length > 0) {
      const lastCode = lastInvoice[0].code;
      const match = lastCode.match(/A-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `A-${String(nextNumber).padStart(5, '0')}`;
  }

  private async getExchangeRate(currencyId: string): Promise<number> {
    const [currency] = await db
      .select()
      .from(currencies)
      .where(eq(currencies.id, currencyId))
      .limit(1);

    if (!currency || currency.isBase) {
      return 1;
    }

    const [rate] = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.currencyId, currencyId))
      .orderBy(desc(exchangeRates.date))
      .limit(1);

    return rate ? parseFloat(rate.rate) : 1;
  }

  private calculateInvoiceTotals(
    items: { quantity: number; price: number; taxRate?: number; isExempt?: boolean }[],
    applyIgtf: boolean,
    exchangeRate: number
  ): { totalBase: number; totalTax: number; totalIgtf: number; total: number } {
    let totalBase = 0;
    let totalTax = 0;

    for (const item of items) {
      const itemBase = item.quantity * item.price;
      totalBase += itemBase;

      if (!item.isExempt && item.taxRate) {
        totalTax += itemBase * (item.taxRate / 100);
      }
    }

    totalBase = Math.round(totalBase * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;

    let totalIgtf = 0;
    if (applyIgtf) {
      totalIgtf = (totalBase + totalTax) * IGTF_RATE;
      totalIgtf = Math.round(totalIgtf * 100) / 100;
    }

    const total = totalBase + totalTax + totalIgtf;

    return { totalBase, totalTax, totalIgtf, total };
  }

  async findAll(branchId?: string, status?: InvoiceStatus): Promise<InvoiceResponseDto[]> {
    let query = db.select().from(invoices);

    const conditions = [];
    if (branchId) conditions.push(eq(invoices.branchId, branchId));
    if (status) conditions.push(eq(invoices.status, status));

    const allInvoices = conditions.length > 0
      ? await db.select().from(invoices).where(and(...conditions))
      : await db.select().from(invoices);

    const invoicesWithItems: InvoiceResponseDto[] = [];

    for (const inv of allInvoices) {
      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, inv.id));

      invoicesWithItems.push({
        ...inv,
        totalBase: parseFloat(String(inv.totalBase)),
        totalTax: parseFloat(String(inv.totalTax)),
        totalIgtf: parseFloat(String(inv.totalIgtf)),
        total: parseFloat(String(inv.total)),
        items: items.map((item) => ({
          ...item,
          quantity: parseFloat(String(item.quantity)),
          price: parseFloat(String(item.price)),
          taxRate: parseFloat(String(item.taxRate)),
          total: parseFloat(String(item.total)),
        })),
      });
    }

    return invoicesWithItems;
  }

  async findOne(id: string): Promise<InvoiceResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id));

    return {
      ...invoice,
      totalBase: parseFloat(String(invoice.totalBase)),
      totalTax: parseFloat(String(invoice.totalTax)),
      totalIgtf: parseFloat(String(invoice.totalIgtf)),
      total: parseFloat(String(invoice.total)),
      items: items.map((item) => ({
        ...item,
        quantity: parseFloat(String(item.quantity)),
        price: parseFloat(String(item.price)),
        taxRate: parseFloat(String(item.taxRate)),
        total: parseFloat(String(item.total)),
      })),
    };
  }

  async create(createInvoiceDto: CreateInvoiceDto, userId: string): Promise<InvoiceResponseDto> {
    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, createInvoiceDto.partnerId))
      .limit(1);

    if (!partner) {
      throw new NotFoundException(`Partner with ID ${createInvoiceDto.partnerId} not found`);
    }

    let currencyId = createInvoiceDto.currencyId;
    if (!currencyId) {
      const [usd] = await db.select().from(currencies).where(eq(currencies.code, 'USD')).limit(1);
      currencyId = usd.id;
    }

    const exchangeRate = createInvoiceDto.exchangeRate || await this.getExchangeRate(currencyId);
    const code = await this.getNextInvoiceCode(createInvoiceDto.branchId);

    const productIds = createInvoiceDto.items.map((item) => item.productId);
    const productRecords = productIds.length > 0
      ? await db.select().from(products).where(
          inArray(products.id, productIds)
        )
      : [];

    const productMap = new Map(productRecords.map((p) => [p.id, p]));

    const applyIgtf = partner.type === 'CUSTOMER' && exchangeRate > 1;

    const itemCalculations = createInvoiceDto.items.map((item) => {
      const product = productMap.get(item.productId);
      const isExempt = product?.isExempt || false;
      const taxRate = item.taxRate ?? (product?.taxRate ? parseFloat(product.taxRate) : 16);

      return {
        ...item,
        isExempt,
        taxRate,
        total: item.quantity * item.price,
      };
    });

    const totals = this.calculateInvoiceTotals(itemCalculations, applyIgtf, exchangeRate);

    const [newInvoice] = await db
      .insert(invoices)
      .values({
        id: uuidv4(),
        code,
        partnerId: createInvoiceDto.partnerId,
        branchId: createInvoiceDto.branchId,
        currencyId,
        exchangeRate: String(exchangeRate),
        type: createInvoiceDto.type || 'SALE',
        invoiceNumber: createInvoiceDto.invoiceNumber,
        orderId: createInvoiceDto.orderId,
        status: InvoiceStatus.DRAFT,
        fiscalStatus: 'PENDING',
        totalBase: String(totals.totalBase),
        totalTax: String(totals.totalTax),
        totalIgtf: String(totals.totalIgtf),
        total: String(totals.total),
        dueDate: createInvoiceDto.dueDate ? new Date(createInvoiceDto.dueDate) : null,
        warehouseId: createInvoiceDto.warehouseId,
        userId,
      })
      .returning();

    const invoiceItemsList: InvoiceItemResponseDto[] = [];

    for (const item of itemCalculations) {
      const [newItem] = await db
        .insert(invoiceItems)
        .values({
          id: uuidv4(),
          invoiceId: newInvoice.id,
          productId: item.productId,
          quantity: String(item.quantity),
          price: String(item.price),
          cost: productMap.get(item.productId)?.cost || null,
          taxRate: String(item.taxRate),
          total: String(item.total),
        })
        .returning();

      invoiceItemsList.push({
        ...newItem,
        quantity: item.quantity,
        price: item.price,
        taxRate: item.taxRate,
        total: item.total,
      });
    }

    return {
      ...newInvoice,
      totalBase: totals.totalBase,
      totalTax: totals.totalTax,
      totalIgtf: totals.totalIgtf,
      total: totals.total,
      items: invoiceItemsList,
    };
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto): Promise<InvoiceResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be updated');
    }

    let exchangeRate = invoice.exchangeRate ? parseFloat(invoice.exchangeRate) : 1;

    if (updateInvoiceDto.exchangeRate) {
      exchangeRate = updateInvoiceDto.exchangeRate;
    }

    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, updateInvoiceDto.partnerId || invoice.partnerId))
      .limit(1);

    const applyIgtf = partner?.type === 'CUSTOMER' && exchangeRate > 1;

    if (updateInvoiceDto.items) {
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));

      const productIds = updateInvoiceDto.items.map((item) => item.productId);
      const productRecords = productIds.length > 0
        ? await db.select().from(products).where(
            inArray(products.id, productIds)
          )
        : [];
      const productMap = new Map(productRecords.map((p) => [p.id, p]));

      const itemCalculations = updateInvoiceDto.items.map((item) => {
        const product = productMap.get(item.productId);
        const isExempt = product?.isExempt || false;
        const taxRate = item.taxRate ?? (product?.taxRate ? parseFloat(product.taxRate) : 16);

        return {
          ...item,
          isExempt,
          taxRate,
          total: item.quantity * item.price,
        };
      });

      const totals = this.calculateInvoiceTotals(itemCalculations, applyIgtf, exchangeRate);

      await db.update(invoices).set({
        partnerId: updateInvoiceDto.partnerId || invoice.partnerId,
        exchangeRate: String(exchangeRate),
        totalBase: String(totals.totalBase),
        totalTax: String(totals.totalTax),
        totalIgtf: String(totals.totalIgtf),
        total: String(totals.total),
        dueDate: updateInvoiceDto.dueDate ? new Date(updateInvoiceDto.dueDate) : invoice.dueDate,
        updatedAt: new Date(),
      }).where(eq(invoices.id, id));

      for (const item of itemCalculations) {
        await db.insert(invoiceItems).values({
          id: uuidv4(),
          invoiceId: id,
          productId: item.productId,
          quantity: String(item.quantity),
          price: String(item.price),
          cost: productMap.get(item.productId)?.cost || null,
          taxRate: String(item.taxRate),
          total: String(item.total),
        });
      }
    }

    return this.findOne(id);
  }

  async post(id: string): Promise<InvoiceResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be posted');
    }

    await db.update(invoices).set({
      status: InvoiceStatus.POSTED,
      fiscalStatus: 'SENT',
      updatedAt: new Date(),
    }).where(eq(invoices.id, id));

    return this.findOne(id);
  }

  async void(id: string): Promise<InvoiceResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Invoice is already void');
    }

    await db.update(invoices).set({
      status: InvoiceStatus.VOID,
      updatedAt: new Date(),
    }).where(eq(invoices.id, id));

    return this.findOne(id);
  }

  async getStats(branchId?: string): Promise<InvoiceStatsDto> {
    const conditions = branchId ? [eq(invoices.branchId, branchId)] : [];

    const allInvoices = conditions.length > 0
      ? await db.select().from(invoices).where(and(...conditions))
      : await db.select().from(invoices);

    let totalAmount = 0;
    let draftCount = 0;
    let postedCount = 0;
    let paidCount = 0;
    let voidCount = 0;

    for (const inv of allInvoices) {
      totalAmount += parseFloat(String(inv.total));

      switch (inv.status) {
        case InvoiceStatus.DRAFT:
          draftCount++;
          break;
        case InvoiceStatus.POSTED:
          postedCount++;
          break;
        case InvoiceStatus.PAID:
          paidCount++;
          break;
        case InvoiceStatus.VOID:
          voidCount++;
          break;
      }
    }

    return {
      totalCount: allInvoices.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      draftCount,
      postedCount,
      paidCount,
      voidCount,
    };
  }

  async getFiscalJson(id: string): Promise<FiscalJsonDto> {
    const invoice = await this.findOne(id);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, invoice.partnerId))
      .limit(1);

    const mockControlCode = `CC${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;

    return {
      controlCode: mockControlCode,
      invoiceNumber: invoice.code,
      serial: 'SN-001',
      verificationUrl: `https://sistema.bcv.org.ve/verificar/${mockControlCode}`,
      generationTimestamp: new Date().toISOString(),
      invoiceDate: invoice.date ? invoice.date.toISOString() : null,
      sellerRif: 'J-000000000',
      buyerRif: partner?.taxId || 'N/A',
      totalAmount: invoice.total,
      taxableAmount: invoice.totalBase,
      ivaAmount: invoice.totalTax,
      ivaIgtf: invoice.totalIgtf,
    };
  }
}
