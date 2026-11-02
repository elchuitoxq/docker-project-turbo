import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { db } from '../../../database';

/** Horas maximas de antiguedad de una tasa antes de exigir confirmacion (T-08-10). */
const EXCHANGE_RATE_MAX_AGE_HOURS = Number(process.env.EXCHANGE_RATE_MAX_AGE_HOURS ?? 24);
import {
  invoices,
  invoiceItems,
  partners,
  currencies,
  exchangeRates,
  products,
  branches,
  warehouses,
  orders,
  users,
  payments,
  paymentAllocations,
  creditNotes,
  taxRetentions,
  taxRetentionLines,
} from '../../../schema';
import { eq, and, desc, inArray, isNotNull, like, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { SupplierRetentionService } from '../purchasing/supplier-retention.service';
import { computeInvoiceBalance } from '../purchasing/invoice-balance';
import { isIssuedInvoiceStatus } from '../issued-status';
import { isCustomerType } from '../../partners/partner-type';
import { DocumentEventsService } from '../../documents/document-events.service';
import { AccountingService } from '../../accounting/accounting.service';
import { MoneyService } from '../../../common/money/money.service';
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
  private readonly logger = new Logger(BillingService.name);
  private readonly money = new MoneyService();

  constructor(
    private readonly retentions: SupplierRetentionService = new SupplierRetentionService(),
    private readonly events: DocumentEventsService = new DocumentEventsService(),
    // Asiento fiscal de la factura con su desglose de IVA e IGTF (S-19).
    private readonly accounting: AccountingService = new AccountingService()
  ) {}

  /**
   * Siguiente código de factura. `invoices.code` es único a nivel global, así que la
   * numeración también lo es; el llamador debe invocarlo dentro de la transacción que
   * toma el advisory lock para que dos emisiones no lean el mismo máximo.
   */
  private async getNextInvoiceCode(
    branchId: string,
    executor: Pick<typeof db, 'select'> = db
  ): Promise<string> {
    // Se toma el mÃ¡ximo sobre TODOS los cÃ³digos con formato A-nnnnn: hay documentos
    // sembrados con otros formatos (INV-...) que, al ser los mÃ¡s recientes, hacÃ­an
    // que el generador volviera a A-00001 y chocara con la restricciÃ³n Ãºnica.
    const existing = await executor
      .select({ code: invoices.code })
      .from(invoices)
      .where(like(invoices.code, 'A-%'));

    let nextNumber = 1;
    for (const row of existing) {
      const match = row.code.match(/^A-(\d+)$/);
      if (match) {
        nextNumber = Math.max(nextNumber, parseInt(match[1], 10) + 1);
      }
    }

    return `A-${String(nextNumber).padStart(5, '0')}`;
  }

  /** Moneda funcional del sistema (VES, decision D-01). */
  private async getBaseCurrency(): Promise<{ id: string; code: string }> {
    const [base] = await db
      .select({ id: currencies.id, code: currencies.code })
      .from(currencies)
      .where(eq(currencies.isBase, true))
      .limit(1);

    if (!base) {
      throw new BadRequestException('No base currency configured');
    }

    return base;
  }

  /**
   * Tasa vigente de la moneda. La base vale 1.
   * Rechaza tasas vencidas para no facturar con un valor obsoleto (`T-08-10`).
   */
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

    if (!rate) {
      throw new BadRequestException(
        `No exchange rate registered for ${currency.code}. Register one or send the rate explicitly.`
      );
    }

    const ageHours = (Date.now() - (rate.date?.getTime() ?? Date.now())) / 3_600_000;
    if (ageHours > EXCHANGE_RATE_MAX_AGE_HOURS) {
      throw new BadRequestException(
        `The exchange rate for ${currency.code} is ${ageHours.toFixed(1)}h old (max ${EXCHANGE_RATE_MAX_AGE_HOURS}h). Confirm the rate explicitly to issue the document.`
      );
    }

    return parseFloat(rate.rate);
  }

  /** Tasa vigente por id de moneda (la más reciente). La moneda base no entra: vale 1. */
  private async getRatesById(): Promise<Map<string, number>> {
    const rows = await db
      .select({ currencyId: exchangeRates.currencyId, rate: exchangeRates.rate })
      .from(exchangeRates)
      .orderBy(desc(exchangeRates.date));

    const rates = new Map<string, number>();
    for (const row of rows) {
      if (!rates.has(row.currencyId)) rates.set(row.currencyId, parseFloat(row.rate));
    }
    return rates;
  }

  /**
   * Convierte un monto a la moneda del documento con la tasa del documento.
   *
   * Un producto cuyo costo está en divisa y una factura en moneda funcional no pueden guardar la
   * línea con el costo sin convertir: el margen por línea quedaría mezclando dos monedas.
   */
  private toDocumentCurrency(params: {
    amount: number;
    fromCurrencyId: string | null | undefined;
    documentCurrencyId: string;
    documentRate: number;
    baseCurrencyId: string;
    rates: Map<string, number>;
    label: string;
  }): number {
    const { amount, fromCurrencyId, documentCurrencyId, documentRate } = params;
    if (!fromCurrencyId || fromCurrencyId === documentCurrencyId) return amount;

    const fromRate =
      fromCurrencyId === params.baseCurrencyId ? 1 : params.rates.get(fromCurrencyId);
    if (!fromRate) {
      throw new BadRequestException(
        `No hay tasa registrada para ${params.label}: regístrala antes de emitir el documento`
      );
    }

    const base = this.money.toBase(amount, fromRate);
    return Number(this.money.round(this.money.fromBase(base.toString(), documentRate)));
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

  async findAll(
    branchId: string,
    status?: InvoiceStatus,
    type?: string
  ): Promise<InvoiceResponseDto[]> {
    const conditions = [eq(invoices.branchId, branchId)];
    if (status) conditions.push(eq(invoices.status, status));
    if (type) conditions.push(eq(invoices.type, type));

    const allInvoices = await db
      .select()
      .from(invoices)
      .where(and(...conditions));

    const invoicesWithItems: InvoiceResponseDto[] = [];

    for (const inv of allInvoices) {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));

      invoicesWithItems.push({
        ...inv,
        totalBase: parseFloat(String(inv.totalBase)),
        totalTax: parseFloat(String(inv.totalTax)),
        totalIgtf: parseFloat(String(inv.totalIgtf)),
        total: parseFloat(String(inv.total)),
        items: items.map(item => ({
          ...item,
          quantity: parseFloat(String(item.quantity)),
          price: parseFloat(String(item.price)),
          taxRate: parseFloat(String(item.taxRate)),
          total: parseFloat(String(item.total)),
        })),
      });
    }

    return this.withPartnerNames(invoicesWithItems);
  }

  /** Añade el nombre del tercero al listado: la UI muestra partner, no UUID. */
  private async withPartnerNames(rows: InvoiceResponseDto[]): Promise<InvoiceResponseDto[]> {
    const partnerIds = [...new Set(rows.map(row => row.partnerId).filter(Boolean))];
    if (partnerIds.length === 0) return rows;

    const partnerRows = await db
      .select({ id: partners.id, name: partners.name })
      .from(partners)
      .where(inArray(partners.id, partnerIds));
    const names = new Map(partnerRows.map(row => [row.id, row.name]));

    return rows.map(row => ({ ...row, partnerName: names.get(row.partnerId) ?? null }));
  }

  /**
   * Listado paginado en servidor (T-01-14). Se expone con `?paginated=true` para no
   * romper a los consumidores que esperan el arreglo plano.
   */
  async findPaginated(options: {
    branchId: string;
    status?: InvoiceStatus;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: InvoiceResponseDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(options.page ?? 1, 1);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const conditions = [eq(invoices.branchId, options.branchId)];
    if (options.status) conditions.push(eq(invoices.status, options.status));
    if (options.type) conditions.push(eq(invoices.type, options.type));

    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(where);

    const rows = await db
      .select()
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const data: InvoiceResponseDto[] = [];
    for (const invoice of rows) {
      data.push(await this.findOne(invoice.id));
    }

    return { data, total: Number(count), page, limit };
  }
  async findOne(id: string, branchId?: string): Promise<InvoiceResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

    // R2: un recurso de otra sucursal responde 404, no 403 (no se filtra su existencia).
    if (!invoice || (branchId && invoice.branchId !== branchId)) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));

    const [partner] = await db
      .select({ name: partners.name })
      .from(partners)
      .where(eq(partners.id, invoice.partnerId))
      .limit(1);

    const detail = await this.withDocumentDetail(invoice);

    return {
      ...invoice,
      ...detail,
      partnerName: partner?.name ?? null,
      // La tasa se expone numérica: el documento la congela y la UI la multiplica, no la compara como texto.
      exchangeRate: invoice.exchangeRate === null ? null : Number(invoice.exchangeRate),
      totalBase: parseFloat(String(invoice.totalBase)),
      totalTax: parseFloat(String(invoice.totalTax)),
      totalIgtf: parseFloat(String(invoice.totalIgtf)),
      total: parseFloat(String(invoice.total)),
      items: await this.withProductNames(
        items.map(item => ({
          ...item,
          quantity: parseFloat(String(item.quantity)),
          price: parseFloat(String(item.price)),
          taxRate: parseFloat(String(item.taxRate)),
          total: parseFloat(String(item.total)),
        }))
      ),
    };
  }

  /**
   * Ficha de la factura con su histórico de procesos (`S-12`).
   *
   * Se expone aparte de `findOne`: las llamadas internas (crear, editar, emitir, anular) no necesitan
   * el histórico y no deben pagar sus consultas.
   */
  async findOneWithHistory(id: string, branchId?: string): Promise<InvoiceResponseDto> {
    const invoice = await this.findOne(id, branchId);

    return { ...invoice, history: await this.events.forInvoice(invoice.id) };
  }

  /**
   * Datos de la ficha del documento (`S-10`).
   *
   * Sólo se resuelven en el detalle: el listado no necesita moneda, pagos ni saldo, y cargarlos ahí
   * multiplicaría las consultas por fila. Todo se resuelve en lote con `inArray`.
   */
  private async withDocumentDetail(
    invoice: typeof invoices.$inferSelect
  ): Promise<
    Pick<
      InvoiceResponseDto,
      | 'currencyCode'
      | 'branchName'
      | 'warehouseName'
      | 'orderCode'
      | 'createdByName'
      | 'daysOverdue'
      | 'settlement'
      | 'payments'
      | 'creditNotes'
      | 'retentions'
    >
  > {
    const [currency] = await db
      .select({ code: currencies.code })
      .from(currencies)
      .where(eq(currencies.id, invoice.currencyId))
      .limit(1);

    const [branch] = await db
      .select({ name: branches.name })
      .from(branches)
      .where(eq(branches.id, invoice.branchId))
      .limit(1);

    const [warehouse] = invoice.warehouseId
      ? await db
          .select({ name: warehouses.name })
          .from(warehouses)
          .where(eq(warehouses.id, invoice.warehouseId))
          .limit(1)
      : [];

    const [order] = invoice.orderId
      ? await db
          .select({ code: orders.code })
          .from(orders)
          .where(eq(orders.id, invoice.orderId))
          .limit(1)
      : [];

    const [author] = invoice.userId
      ? await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, invoice.userId))
          .limit(1)
      : [];

    const balance = await computeInvoiceBalance(invoice.id);

    const paymentRows = await db
      .select({
        id: payments.id,
        code: payments.code,
        date: payments.date,
        amount: payments.amount,
        exchangeRate: payments.exchangeRate,
        status: payments.status,
        reference: payments.reference,
        currencyCode: currencies.code,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .leftJoin(currencies, eq(currencies.id, payments.currencyId))
      .where(eq(paymentAllocations.invoiceId, invoice.id));

    const noteRows = await db
      .select({
        id: creditNotes.id,
        code: creditNotes.code,
        total: creditNotes.total,
        status: creditNotes.status,
      })
      .from(creditNotes)
      .where(eq(creditNotes.invoiceId, invoice.id));

    const retentionRows = await db
      .select({
        id: taxRetentions.id,
        code: taxRetentions.code,
        type: taxRetentions.type,
        totalBase: taxRetentions.totalBase,
        totalRetained: taxRetentions.totalRetained,
        voucherNumber: taxRetentions.voucherNumber,
        date: taxRetentions.date,
      })
      .from(taxRetentions)
      .where(eq(taxRetentions.invoiceId, invoice.id));

    return {
      currencyCode: currency?.code ?? null,
      branchName: branch?.name ?? null,
      warehouseName: warehouse?.name ?? null,
      orderCode: order?.code ?? null,
      createdByName: author?.name ?? null,
      daysOverdue: this.daysOverdue(invoice.dueDate),
      settlement: balance
        ? {
            total: balance.total,
            paid: balance.paid,
            credited: balance.credited,
            retained: balance.retained,
            settled: balance.settled,
            balance: balance.balance,
          }
        : undefined,
      payments: paymentRows.map(row => ({
        id: row.id,
        code: row.code,
        date: row.date,
        amount: parseFloat(String(row.amount)),
        exchangeRate: row.exchangeRate === null ? null : Number(row.exchangeRate),
        status: row.status,
        reference: row.reference ?? null,
        currencyCode: row.currencyCode ?? null,
      })),
      creditNotes: noteRows.map(row => ({
        id: row.id,
        code: row.code,
        total: parseFloat(String(row.total)),
        status: row.status,
      })),
      retentions: retentionRows.map(row => ({
        id: row.id,
        code: row.code,
        type: row.type,
        totalBase: parseFloat(String(row.totalBase)),
        totalRetained: parseFloat(String(row.totalRetained)),
        voucherNumber: row.voucherNumber,
        date: row.date,
      })),
    };
  }

  /** Días vencidos; 0 si no hay vencimiento o todavía no venció. */
  private daysOverdue(dueDate: Date | null): number {
    if (!dueDate) return 0;
    const diff = Date.now() - new Date(dueDate).getTime();
    if (diff <= 0) return 0;
    return Math.floor(diff / 86_400_000);
  }

  /** SKU y nombre de cada producto de la factura, en una sola consulta. */
  private async withProductNames(
    items: InvoiceItemResponseDto[]
  ): Promise<InvoiceItemResponseDto[]> {
    const productIds = [...new Set(items.map(item => item.productId))];
    if (productIds.length === 0) return items;

    const rows = await db
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(inArray(products.id, productIds));
    const byId = new Map(rows.map(row => [row.id, row]));

    return items.map(item => ({
      ...item,
      productSku: byId.get(item.productId)?.sku ?? null,
      productName: byId.get(item.productId)?.name ?? null,
    }));
  }

  async create(
    createInvoiceDto: CreateInvoiceDto,
    userId: string,
    branchId?: string
  ): Promise<InvoiceResponseDto> {
    // La sucursal validada por el guard manda sobre lo que venga en el body.
    const invoiceBranchId = branchId ?? createInvoiceDto.branchId;

    if (!invoiceBranchId) {
      throw new BadRequestException('La factura necesita una sucursal activa (x-branch-id)');
    }

    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, createInvoiceDto.partnerId))
      .limit(1);

    if (!partner) {
      throw new NotFoundException(`Partner with ID ${createInvoiceDto.partnerId} not found`);
    }

    let currencyId = createInvoiceDto.currencyId;
    const baseCurrency = await this.getBaseCurrency();
    if (!currencyId) {
      currencyId = baseCurrency.id;
    }

    const exchangeRate =
      currencyId === baseCurrency.id
        ? 1
        : (createInvoiceDto.exchangeRate ?? (await this.getExchangeRate(currencyId)));
    const isForeignCurrency = currencyId !== baseCurrency.id;

    const productIds = createInvoiceDto.items.map(item => item.productId);
    const productRecords =
      productIds.length > 0
        ? await db.select().from(products).where(inArray(products.id, productIds))
        : [];

    const productMap = new Map(productRecords.map(p => [p.id, p]));

    // M6: el IGTF depende de la moneda, no de la magnitud de la tasa.
    const applyIgtf = isCustomerType(partner.type) && isForeignCurrency;

    const rates = await this.getRatesById();
    const toDoc = (amount: number, fromCurrencyId: string | null | undefined, label: string) =>
      this.toDocumentCurrency({
        amount,
        fromCurrencyId,
        documentCurrencyId: currencyId,
        documentRate: exchangeRate,
        baseCurrencyId: baseCurrency.id,
        rates,
        label,
      });

    const itemCalculations = createInvoiceDto.items.map(item => {
      const product = productMap.get(item.productId);
      const isExempt = product?.isExempt || false;
      const taxRate = item.taxRate ?? (product?.taxRate ? parseFloat(product.taxRate) : 16);
      // El precio llega en la moneda del documento salvo que el cliente declare otra.
      const price = item.priceCurrencyId
        ? toDoc(item.price, item.priceCurrencyId, 'la moneda del precio')
        : item.price;

      return {
        ...item,
        isExempt,
        taxRate,
        price,
        total: item.quantity * price,
      };
    });

    const totals = this.calculateInvoiceTotals(itemCalculations, applyIgtf, exchangeRate);

    // El cÃ³digo se asigna dentro de una transacciÃ³n con advisory lock: dos emisiones
    // concurrentes se serializan y no pueden leer el mismo mÃ¡ximo.
    const newInvoice = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(42001)`);
      const lockedCode = await this.getNextInvoiceCode(invoiceBranchId, tx);

      const [row] = await tx
        .insert(invoices)
        .values({
          id: uuidv4(),
          code: lockedCode,
          partnerId: createInvoiceDto.partnerId,
          branchId: invoiceBranchId,
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
          dueDate: this.resolveDueDate(createInvoiceDto, partner),
          supplierInvoiceNumber: createInvoiceDto.supplierInvoiceNumber ?? null,
          supplierInvoiceDate: createInvoiceDto.supplierInvoiceDate
            ? new Date(createInvoiceDto.supplierInvoiceDate)
            : null,
          warehouseId: createInvoiceDto.warehouseId,
          userId,
        })
        .returning();

      return row;
    });

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
          cost: productMap.get(item.productId)?.cost
            ? String(
                toDoc(
                  Number(productMap.get(item.productId)?.cost),
                  productMap.get(item.productId)?.currencyId ?? baseCurrency.id,
                  'el costo del producto'
                )
              )
            : null,
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

    await this.events.record({
      documentType: 'INVOICE',
      documentId: newInvoice.id,
      documentCode: newInvoice.code,
      // La factura nacida de un pedido arrastra su cadena: así el histórico se lee completo.
      parentDocumentId: newInvoice.orderId ?? null,
      action: 'INVOICE_CREATED',
      toStatus: InvoiceStatus.DRAFT,
      description:
        createInvoiceDto.orderId !== undefined
          ? 'Generada desde un pedido'
          : `${newInvoice.type === 'PURCHASE' ? 'Compra' : 'Venta'} · ${
              itemCalculations.length
            } línea${itemCalculations.length === 1 ? '' : 's'}`,
      metadata: {
        total: totals.total,
        items: itemCalculations.length,
        exchangeRate,
        orderId: createInvoiceDto.orderId ?? null,
      },
      userId: userId ?? null,
      branchId: invoiceBranchId,
    });

    return {
      ...newInvoice,
      totalBase: totals.totalBase,
      totalTax: totals.totalTax,
      totalIgtf: totals.totalIgtf,
      total: totals.total,
      items: invoiceItemsList,
    };
  }

  async update(
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
    branchId?: string,
    userId?: string
  ): Promise<InvoiceResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

    if (!invoice || (branchId && invoice.branchId !== branchId)) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be updated');
    }

    const baseCurrency = await this.getBaseCurrency();
    const isForeignCurrency = invoice.currencyId !== baseCurrency.id;

    let exchangeRate = invoice.exchangeRate ? parseFloat(invoice.exchangeRate) : 1;

    if (updateInvoiceDto.exchangeRate) {
      exchangeRate = updateInvoiceDto.exchangeRate;
    }

    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, updateInvoiceDto.partnerId || invoice.partnerId))
      .limit(1);

    const applyIgtf = isCustomerType(partner?.type) && isForeignCurrency;

    if (updateInvoiceDto.items) {
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));

      const productIds = updateInvoiceDto.items.map(item => item.productId);
      const productRecords =
        productIds.length > 0
          ? await db.select().from(products).where(inArray(products.id, productIds))
          : [];
      const productMap = new Map(productRecords.map(p => [p.id, p]));

      const rates = await this.getRatesById();
      const toDoc = (amount: number, fromCurrencyId: string | null | undefined, label: string) =>
        this.toDocumentCurrency({
          amount,
          fromCurrencyId,
          documentCurrencyId: invoice.currencyId,
          documentRate: exchangeRate,
          baseCurrencyId: baseCurrency.id,
          rates,
          label,
        });

      const itemCalculations = updateInvoiceDto.items.map(item => {
        const product = productMap.get(item.productId);
        const isExempt = product?.isExempt || false;
        const taxRate = item.taxRate ?? (product?.taxRate ? parseFloat(product.taxRate) : 16);
        const price = item.priceCurrencyId
          ? toDoc(item.price, item.priceCurrencyId, 'la moneda del precio')
          : item.price;

        return {
          ...item,
          isExempt,
          taxRate,
          price,
          total: item.quantity * price,
        };
      });

      const totals = this.calculateInvoiceTotals(itemCalculations, applyIgtf, exchangeRate);

      await db
        .update(invoices)
        .set({
          partnerId: updateInvoiceDto.partnerId || invoice.partnerId,
          exchangeRate: String(exchangeRate),
          totalBase: String(totals.totalBase),
          totalTax: String(totals.totalTax),
          totalIgtf: String(totals.totalIgtf),
          total: String(totals.total),
          dueDate: updateInvoiceDto.dueDate ? new Date(updateInvoiceDto.dueDate) : invoice.dueDate,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id));

      for (const item of itemCalculations) {
        await db.insert(invoiceItems).values({
          id: uuidv4(),
          invoiceId: id,
          productId: item.productId,
          quantity: String(item.quantity),
          price: String(item.price),
          cost: productMap.get(item.productId)?.cost
            ? String(
                toDoc(
                  Number(productMap.get(item.productId)?.cost),
                  productMap.get(item.productId)?.currencyId ?? baseCurrency.id,
                  'el costo del producto'
                )
              )
            : null,
          taxRate: String(item.taxRate),
          total: String(item.total),
        });
      }
    } else if (updateInvoiceDto.exchangeRate !== undefined) {
      // Sin líneas nuevas los precios no cambian: sólo se recalculan IVA, IGTF y totales con la tasa
      // corregida, que es lo que se ajusta en un borrador.
      const storedItems = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id));

      const storedProducts =
        storedItems.length > 0
          ? await db
              .select()
              .from(products)
              .where(
                inArray(
                  products.id,
                  storedItems.map(item => item.productId)
                )
              )
          : [];

      const totals = this.calculateInvoiceTotals(
        storedItems.map(item => ({
          quantity: parseFloat(String(item.quantity)),
          price: parseFloat(String(item.price)),
          taxRate: parseFloat(String(item.taxRate ?? 0)),
          isExempt:
            storedProducts.find(product => product.id === item.productId)?.isExempt ?? false,
        })),
        applyIgtf,
        exchangeRate
      );

      await db
        .update(invoices)
        .set({
          exchangeRate: String(exchangeRate),
          totalBase: String(totals.totalBase),
          totalTax: String(totals.totalTax),
          totalIgtf: String(totals.totalIgtf),
          total: String(totals.total),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id));
    }

    await this.events.record({
      documentType: 'INVOICE',
      documentId: id,
      documentCode: invoice.code,
      parentDocumentId: invoice.orderId ?? null,
      action: 'INVOICE_UPDATED',
      fromStatus: invoice.status,
      toStatus: invoice.status,
      description: `Campos: ${Object.keys(updateInvoiceDto).join(', ')}`,
      metadata: { fields: Object.keys(updateInvoiceDto) },
      userId: userId ?? null,
      branchId: invoice.branchId,
    });

    return this.findOne(id);
  }

  async post(id: string, branchId?: string, userId?: string): Promise<InvoiceResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

    if (!invoice || (branchId && invoice.branchId !== branchId)) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be posted');
    }

    await db
      .update(invoices)
      .set({
        status: InvoiceStatus.POSTED,
        fiscalStatus: 'SENT',
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id));

    // En una compra, publicar es el momento fiscal: se emiten los comprobantes de retención.
    if (invoice.type === 'PURCHASE') {
      await this.retentions.retainInvoice(invoice.id);
    }

    // Asiento de la factura con desglose de IVA/IGTF (`S-19`). Si el plan de cuentas o el período no
    // lo permiten, se avisa y la emisión sigue: el documento fiscal no puede quedar bloqueado por la
    // contabilidad, y el asiento se puede regenerar desde `POST /v1/accounting/entries/from-invoice`.
    await this.accounting
      .createEntryFromInvoice(invoice.id, userId)
      .catch((error: Error) =>
        this.logger.warn(`No se pudo contabilizar la factura ${invoice.code}: ${error.message}`)
      );

    await this.events.record({
      documentType: 'INVOICE',
      documentId: id,
      documentCode: invoice.code,
      parentDocumentId: invoice.orderId ?? null,
      action: 'INVOICE_POSTED',
      fromStatus: invoice.status,
      toStatus: InvoiceStatus.POSTED,
      description: invoice.invoiceNumber ? `Folio fiscal ${invoice.invoiceNumber}` : null,
      metadata: { folio: invoice.invoiceNumber ?? null },
      userId: userId ?? null,
      branchId: invoice.branchId,
    });

    return this.findOne(id);
  }

  /**
   * Vencimiento de la factura: el que llega en el body o, si falta, emisión + días de crédito del
   * partner (`T-03-02`). Sin días de crédito y sin fecha, queda sin vencimiento (se trata como
   * "por vencer" en la antigüedad).
   */
  private resolveDueDate(
    dto: { dueDate?: string; date?: string },
    partner: typeof partners.$inferSelect
  ): Date | null {
    if (dto.dueDate) return new Date(dto.dueDate);

    const creditDays = Number(partner.creditDays ?? 0);
    if (creditDays <= 0) return null;

    const issue = dto.date ? new Date(dto.date) : new Date();
    return new Date(issue.getTime() + creditDays * 24 * 60 * 60 * 1000);
  }

  async void(
    id: string,
    branchId?: string,
    userId?: string,
    reason?: string
  ): Promise<InvoiceResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

    if (!invoice || (branchId && invoice.branchId !== branchId)) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Invoice is already void');
    }

    // Regla 5 de `S-03`: primero se anula el pago o se emite una nota de crédito.
    if (Number(invoice.paidAmount ?? 0) > 0) {
      throw new ConflictException(
        'La factura tiene pagos aplicados: anula el pago o emite una nota de crédito'
      );
    }

    // Una nota de crédito vigente contra una factura anulada es un crédito huérfano: seguiría
    // restando en el libro fiscal y en el saldo del tercero. Se anula primero la nota.
    const [activeNote] = await db
      .select({ code: creditNotes.code })
      .from(creditNotes)
      .where(and(eq(creditNotes.invoiceId, id), inArray(creditNotes.status, ['POSTED', 'APPLIED'])))
      .limit(1);

    if (activeNote) {
      throw new ConflictException(
        `La factura tiene la nota de crédito ${activeNote.code} vigente: anula la nota antes de anular la factura`
      );
    }

    // Regla 2 de `S-04`: un período contable cerrado no admite más movimientos, y anular es uno.
    await this.accounting.assertPeriodOpen(invoice.date ?? new Date(), invoice.branchId);

    // Retenciones emitidas por la compra: si no respaldan ningún pago, se van con la factura; si ya
    // se aplicaron a un pago, primero hay que anular ese pago para no dejar el comprobante huérfano.
    const retentions = await db
      .select({ id: taxRetentions.id, code: taxRetentions.code })
      .from(taxRetentions)
      .where(eq(taxRetentions.invoiceId, id));

    if (retentions.length > 0) {
      const retentionIds = retentions.map(row => row.id);
      const [used] = await db
        .select({ id: taxRetentionLines.id })
        .from(taxRetentionLines)
        .where(
          and(
            inArray(taxRetentionLines.retentionId, retentionIds),
            isNotNull(taxRetentionLines.paymentId)
          )
        )
        .limit(1);

      if (used) {
        throw new ConflictException(
          'La compra tiene retenciones aplicadas a un pago: anula el pago antes de anular la factura'
        );
      }

      await db.delete(taxRetentions).where(inArray(taxRetentions.id, retentionIds));
    }

    await db
      .update(invoices)
      .set({
        status: InvoiceStatus.VOID,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id));

    // Anular el documento anula su asiento: si quedara vigente, el ingreso y el IVA seguirían en el
    // mayor con la factura anulada (`S-19`).
    await this.accounting
      .cancelEntryBySource('INVOICE', id, userId)
      .catch((error: Error) =>
        this.logger.warn(
          `No se pudo anular el asiento de la factura ${invoice.code}: ${error.message}`
        )
      );

    await this.events.record({
      documentType: 'INVOICE',
      documentId: id,
      documentCode: invoice.code,
      parentDocumentId: invoice.orderId ?? null,
      action: 'INVOICE_VOIDED',
      fromStatus: invoice.status,
      toStatus: InvoiceStatus.VOID,
      description: reason?.trim() ? `Factura anulada: ${reason.trim()}` : 'Factura anulada',
      metadata: {
        reason: reason?.trim() || null,
        retentionsRemoved: retentions.map(row => row.code),
      },
      userId: userId ?? null,
      branchId: invoice.branchId,
    });

    return this.findOne(id);
  }

  async getStats(branchId: string, type?: string): Promise<InvoiceStatsDto> {
    const conditions = [eq(invoices.branchId, branchId)];
    // La pantalla de ventas y la de compras muestran sus propias cifras: sin este filtro los KPI
    // mezclaban facturas de venta con facturas de proveedor (S-16).

    if (type) conditions.push(eq(invoices.type, type));

    const allInvoices = await db
      .select()
      .from(invoices)
      .where(and(...conditions));

    let totalAmount = 0;
    let draftCount = 0;
    let postedCount = 0;
    let paidCount = 0;
    let voidCount = 0;

    for (const inv of allInvoices) {
      // "Emitida" es todo documento que ya salió del borrador y no está anulado: POSTED, PAID y
      // PARTIAL suman al total facturado. Antes se sumaban también los borradores y las anuladas,
      // así que el KPI no cuadraba con los documentos vigentes (`S-16` M-15).
      const status = inv.status as string;
      const isIssued = isIssuedInvoiceStatus(status);

      if (isIssued) {
        // Se suma en moneda funcional: sumar `total` de facturas en monedas distintas da un número
        // que no significa nada (regla 5 de `S-08`). Ojo: `total_base` es la base imponible del
        // documento, no el monto en moneda funcional.
        const rate = parseFloat(String(inv.exchangeRate ?? 1)) || 1;
        totalAmount += parseFloat(String(inv.total)) * rate;
      }

      switch (status) {
        case InvoiceStatus.DRAFT:
          draftCount++;
          break;
        case InvoiceStatus.POSTED:
        case 'PARTIAL':
          postedCount++;
          break;
        case InvoiceStatus.PAID:
          paidCount++;
          postedCount++;
          break;
        // `CANCELLED` quedó en documentos de semillas antiguas: es una anulada más.
        case InvoiceStatus.VOID:
        case 'CANCELLED':
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

  async getFiscalJson(id: string, branchId?: string): Promise<FiscalJsonDto> {
    const invoice = await this.findOne(id, branchId);

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
