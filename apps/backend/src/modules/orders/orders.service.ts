import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { db } from '../../database';
import {
  orders,
  orderItems,
  partners,
  branches,
  warehouses,
  currencies,
  users,
  products,
  invoices,
  exchangeRates,
} from '../../schema';
import { eq, sql, and, like, inArray, desc } from 'drizzle-orm';
import { BillingService } from '../billing/services/billing.service';
import { InvoiceType } from '../billing/dto/billing.dto';
import { ISSUED_INVOICE_STATUSES } from '../billing/issued-status';
import { MoneyService } from '../../common/money/money.service';
import { DocumentEventsService } from '../documents/document-events.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  OrderResponseDto,
  OrderItemResponseDto,
  OrderStatsResponseDto,
  OrderStatus,
  ConfirmOrderResponseDto,
  CancelOrderResponseDto,
} from './dto/orders.dto';

@Injectable()
export class OrdersService {
  private readonly money = new MoneyService();

  constructor(
    private readonly billing: BillingService = new BillingService(),
    private readonly events: DocumentEventsService = new DocumentEventsService()
  ) {}

  /**
   * Tasa con la que nace el pedido: la que manda el cliente o, si no viene, la vigente de la
   * moneda del pedido. La moneda funcional siempre vale 1 (`S-08`).
   */
  private async resolveExchangeRate(
    currencyId?: string | null,
    explicit?: number
  ): Promise<string> {
    if (explicit !== undefined && explicit !== null && explicit > 0) return explicit.toString();
    if (!currencyId) return '1';

    const [currency] = await db
      .select({ code: currencies.code, isBase: currencies.isBase })
      .from(currencies)
      .where(eq(currencies.id, currencyId))
      .limit(1);

    if (!currency || currency.isBase) return '1';

    const [rate] = await db
      .select({ rate: exchangeRates.rate })
      .from(exchangeRates)
      .where(eq(exchangeRates.currencyId, currencyId))
      .orderBy(desc(exchangeRates.date))
      .limit(1);

    if (!rate) {
      throw new BadRequestException(
        `No hay tasa registrada para ${currency.code}: regístrala o envía la tasa del pedido`
      );
    }

    return Number(rate.rate).toString();
  }

  /** Moneda funcional del sistema (VES, decisión D-01). */
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
   * Convierte un monto a la moneda del pedido con la tasa del pedido (regla M4 de `S-08`).
   *
   * El precio del producto puede venir en su propia moneda: la línea siempre se guarda en la moneda
   * del documento para que el total y la factura no mezclen importes.
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
        `No hay tasa registrada para ${params.label}: regístrala antes de guardar el pedido`
      );
    }

    const base = this.money.toBase(amount, fromRate);
    return Number(this.money.round(this.money.fromBase(base.toString(), documentRate)));
  }

  async findAll(
    status?: OrderStatus,
    partnerId?: string,
    branchId?: string
  ): Promise<OrderResponseDto[]> {
    let query = db.select().from(orders);

    const conditions = [];

    if (branchId) {
      conditions.push(eq(orders.branchId, branchId));
    }

    if (status) {
      conditions.push(eq(orders.status, status));
    }

    if (partnerId) {
      conditions.push(eq(orders.partnerId, partnerId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const allOrders = await query;

    const partnerIds = [...new Set(allOrders.map(order => order.partnerId))];
    const partnerRows =
      partnerIds.length > 0
        ? await db
            .select({ id: partners.id, name: partners.name })
            .from(partners)
            .where(inArray(partners.id, partnerIds))
        : [];
    const partnerNames = new Map(partnerRows.map(row => [row.id, row.name]));

    return Promise.all(
      allOrders.map(async order => ({
        ...(await this.toResponseDto(order)),
        partnerName: partnerNames.get(order.partnerId) ?? null,
      }))
    );
  }

  async findOne(id: string, branchId?: string): Promise<OrderResponseDto> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    // R2: pedido de otra sucursal -> 404.
    if (!order || (branchId && order.branchId !== branchId)) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const response = await this.toResponseDto(order, true);
    return this.withDocumentDetail(response);
  }

  /**
   * Ficha del pedido con su histórico de procesos (`S-12`).
   *
   * Se expone aparte de `findOne` a propósito: el histórico cuesta tres consultas y no lo necesitan ni
   * el listado ni las llamadas internas que el servicio hace para validar sucursal.
   */
  async findOneWithHistory(id: string, branchId?: string): Promise<OrderResponseDto> {
    const order = await this.findOne(id, branchId);

    return { ...order, history: await this.events.forOrder(order.id) };
  }

  /**
   * Datos de la ficha del pedido (`S-10`).
   *
   * Sólo en el detalle: el listado no necesita RIF, almacén ni la factura asociada, y resolverlo por
   * fila multiplicaría las consultas.
   */
  private async withDocumentDetail(order: OrderResponseDto): Promise<OrderResponseDto> {
    const [partner] = await db
      .select({ name: partners.name, taxId: partners.taxId })
      .from(partners)
      .where(eq(partners.id, order.partnerId))
      .limit(1);

    const [branch] = await db
      .select({ name: branches.name })
      .from(branches)
      .where(eq(branches.id, order.branchId))
      .limit(1);

    const [warehouse] = order.warehouseId
      ? await db
          .select({ name: warehouses.name })
          .from(warehouses)
          .where(eq(warehouses.id, order.warehouseId))
          .limit(1)
      : [];

    const [currency] = order.currencyId
      ? await db
          .select({ code: currencies.code })
          .from(currencies)
          .where(eq(currencies.id, order.currencyId))
          .limit(1)
      : [];

    const [author] = order.userId
      ? await db.select({ name: users.name }).from(users).where(eq(users.id, order.userId)).limit(1)
      : [];

    const [invoice] = await db
      .select({ id: invoices.id, code: invoices.code, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.orderId, order.id))
      .limit(1);

    const items = order.items ?? [];
    const productIds = [...new Set(items.map(item => item.productId))];
    const productRows =
      productIds.length > 0
        ? await db
            .select({ id: products.id, sku: products.sku, name: products.name })
            .from(products)
            .where(inArray(products.id, productIds))
        : [];
    const productById = new Map(productRows.map(row => [row.id, row]));

    return {
      ...order,
      partnerName: partner?.name ?? order.partnerName ?? null,
      partnerTaxId: partner?.taxId ?? null,
      branchName: branch?.name ?? null,
      warehouseName: warehouse?.name ?? null,
      currencyCode: currency?.code ?? null,
      createdByName: author?.name ?? null,
      invoiceId: invoice?.id ?? null,
      invoiceCode: invoice?.code ?? null,
      invoiceStatus: invoice?.status ?? null,
      items: items.map(item => ({
        ...item,
        productSku: productById.get(item.productId)?.sku ?? null,
        productName: productById.get(item.productId)?.name ?? null,
      })),
    };
  }

  async create(
    createOrderDto: CreateOrderDto,
    branchId?: string,
    userId?: string
  ): Promise<OrderResponseDto> {
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.code, createOrderDto.code))
      .limit(1);

    if (existingOrder) {
      throw new BadRequestException(`Order with code ${createOrderDto.code} already exists`);
    }

    const exchangeRate = await this.resolveExchangeRate(
      createOrderDto.currencyId,
      createOrderDto.exchangeRate
    );

    // Sólo se consultan tasas cuando el cliente declara el precio en otra moneda.
    const needsConversion = createOrderDto.items.some(item => Boolean(item.priceCurrencyId));
    const baseCurrency = needsConversion ? await this.getBaseCurrency() : null;
    const rates = needsConversion ? await this.getRatesById() : new Map<string, number>();
    const documentCurrencyId = createOrderDto.currencyId ?? baseCurrency?.id;

    // El precio puede venir en la moneda del producto: la línea se guarda en la del pedido.
    const items = createOrderDto.items.map(item => {
      if (!item.priceCurrencyId) return item;

      return {
        ...item,
        price: this.toDocumentCurrency({
          amount: item.price,
          fromCurrencyId: item.priceCurrencyId,
          documentCurrencyId: documentCurrencyId as string,
          documentRate: Number(exchangeRate),
          baseCurrencyId: (baseCurrency as { id: string }).id,
          rates,
          label: 'la moneda del precio',
        }),
      };
    });

    const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    // La sucursal validada por el guard manda; el body sólo sirve de respaldo.
    const orderBranchId = branchId ?? createOrderDto.branchId;
    if (!orderBranchId) {
      throw new BadRequestException('El pedido necesita una sucursal activa (x-branch-id)');
    }

    const [newOrder] = await db
      .insert(orders)
      .values({
        code: createOrderDto.code,
        partnerId: createOrderDto.partnerId,
        branchId: orderBranchId,
        warehouseId: createOrderDto.warehouseId,
        type: createOrderDto.type || 'SALE',
        status: OrderStatus.DRAFT,
        total: total.toString(),
        exchangeRate,
        currencyId: createOrderDto.currencyId,
        date: createOrderDto.date ? new Date(createOrderDto.date) : new Date(),
        // Autor del pedido: es el que la ficha muestra como "Registró" y el que firma el primer paso
        // del histórico (`S-12`).
        userId: userId ?? null,
      })
      .returning();

    for (const item of items) {
      await db.insert(orderItems).values({
        orderId: newOrder.id,
        productId: item.productId,
        batchId: item.batchId,
        quantity: item.quantity.toString(),
        price: item.price.toString(),
      });
    }

    await this.events.record({
      documentType: 'ORDER',
      documentId: newOrder.id,
      documentCode: newOrder.code,
      action: 'ORDER_CREATED',
      toStatus: OrderStatus.DRAFT,
      // La etiqueta ya dice "Pedido creado": la descripción sólo aporta el contenido del pedido.
      description: `${newOrder.type === 'PURCHASE' ? 'Compra' : 'Venta'} · ${
        createOrderDto.items.length
      } línea${createOrderDto.items.length === 1 ? '' : 's'}`,
      metadata: { total, items: createOrderDto.items.length, type: newOrder.type },
      userId: userId ?? null,
      branchId: orderBranchId,
    });

    return this.findOne(newOrder.id);
  }

  async update(
    id: string,
    updateOrderDto: UpdateOrderDto,
    branchId?: string,
    userId?: string
  ): Promise<OrderResponseDto> {
    if (branchId) await this.findOne(id, branchId);
    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (existing.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled order');
    }

    if (existing.status !== OrderStatus.DRAFT) {
      if (updateOrderDto.status !== undefined) {
        throw new BadRequestException('Only draft orders can change status');
      }

      // La tasa se corrige mientras la factura del pedido no esté emitida: un borrador todavía no es
      // documento fiscal, así que sigue la tasa vigente.
      if (
        updateOrderDto.exchangeRate !== undefined ||
        updateOrderDto.currencyId !== undefined ||
        updateOrderDto.items !== undefined
      ) {
        const [posted] = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(
            and(eq(invoices.orderId, id), inArray(invoices.status, [...ISSUED_INVOICE_STATUSES]))
          )
          .limit(1);

        if (posted) {
          throw new BadRequestException(
            'La tasa no se puede modificar: el pedido ya tiene factura emitida'
          );
        }
      }
    }

    const updateData: Partial<typeof orders.$inferInsert> = {};

    if (updateOrderDto.warehouseId !== undefined) {
      updateData.warehouseId = updateOrderDto.warehouseId;
    }

    if (updateOrderDto.status !== undefined) {
      updateData.status = updateOrderDto.status;
    }

    if (updateOrderDto.currencyId !== undefined) {
      updateData.currencyId = updateOrderDto.currencyId;
      // Cambiar la moneda sin mandar tasa re-resuelve la vigente (la funcional siempre es 1).
      if (updateOrderDto.exchangeRate === undefined) {
        updateData.exchangeRate = await this.resolveExchangeRate(updateOrderDto.currencyId);
      }
    }

    if (updateOrderDto.exchangeRate !== undefined) {
      updateData.exchangeRate = updateOrderDto.exchangeRate.toString();
    }

    if (updateOrderDto.date !== undefined) {
      updateData.date = new Date(updateOrderDto.date);
    }

    if (updateOrderDto.items) {
      const baseCurrency = await this.getBaseCurrency();
      const rates = await this.getRatesById();
      const currencyId = updateOrderDto.currencyId ?? existing.currencyId ?? baseCurrency.id;
      const rate = Number(
        updateOrderDto.exchangeRate ?? updateData.exchangeRate ?? existing.exchangeRate ?? 1
      );

      const items = updateOrderDto.items.map(item => ({
        ...item,
        price: item.priceCurrencyId
          ? this.toDocumentCurrency({
              amount: item.price,
              fromCurrencyId: item.priceCurrencyId,
              documentCurrencyId: currencyId,
              documentRate: rate,
              baseCurrencyId: baseCurrency.id,
              rates,
              label: 'la moneda del precio',
            })
          : item.price,
      }));

      // Las líneas se reemplazan completas: es la única forma de que la reconversión por tasa nueva
      // quede persistida junto al total. El orden (borrar e insertar) es el mismo que usa el billing.
      await db.delete(orderItems).where(eq(orderItems.orderId, id));
      for (const item of items) {
        await db.insert(orderItems).values({
          orderId: id,
          productId: item.productId,
          batchId: item.batchId,
          quantity: String(item.quantity),
          price: String(item.price),
        });
      }

      updateData.total = String(items.reduce((sum, item) => sum + item.quantity * item.price, 0));
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db.update(orders).set(updateData).where(eq(orders.id, id));

      await this.events.record({
        documentType: 'ORDER',
        documentId: id,
        documentCode: existing.code,
        action: 'ORDER_UPDATED',
        fromStatus: existing.status,
        toStatus: updateData.status ?? existing.status,
        description: 'Pedido actualizado',
        metadata: { fields: Object.keys(updateData).filter(key => key !== 'updatedAt') },
        userId: userId ?? null,
        branchId: existing.branchId,
      });
    }

    return this.findOne(id);
  }

  async confirm(id: string, branchId?: string, userId?: string): Promise<ConfirmOrderResponseDto> {
    if (branchId) await this.findOne(id, branchId);
    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (existing.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be confirmed');
    }

    await db
      .update(orders)
      .set({
        status: OrderStatus.CONFIRMED,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    await this.events.record({
      documentType: 'ORDER',
      documentId: id,
      documentCode: existing.code,
      action: 'ORDER_CONFIRMED',
      fromStatus: existing.status,
      toStatus: OrderStatus.CONFIRMED,
      description: null,
      userId: userId ?? null,
      branchId: existing.branchId,
    });

    return {
      id,
      status: OrderStatus.CONFIRMED,
      message: 'Order confirmed successfully',
    };
  }

  async cancel(id: string, branchId?: string, userId?: string): Promise<CancelOrderResponseDto> {
    if (branchId) await this.findOne(id, branchId);
    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (existing.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (existing.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed order');
    }

    await db
      .update(orders)
      .set({
        status: OrderStatus.CANCELLED,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    await this.events.record({
      documentType: 'ORDER',
      documentId: id,
      documentCode: existing.code,
      action: 'ORDER_CANCELLED',
      fromStatus: existing.status,
      toStatus: OrderStatus.CANCELLED,
      description: null,
      userId: userId ?? null,
      branchId: existing.branchId,
    });

    return {
      id,
      status: OrderStatus.CANCELLED,
      message: 'Order cancelled successfully',
    };
  }

  async invoice(
    id: string,
    branchId?: string,
    userId?: string
  ): Promise<{
    message: string;
    orderId: string;
    invoiceId: string;
    invoiceCode: string;
  }> {
    if (branchId) await this.findOne(id, branchId);
    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (existing.status !== OrderStatus.CONFIRMED && existing.status !== OrderStatus.PROCESSING) {
      // Un pedido ya facturado queda COMPLETED: el mensaje útil es "ya tiene factura", no el de estado.
      const [invoiced] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.orderId, id))
        .limit(1);

      if (invoiced) {
        throw new ConflictException('El pedido ya tiene una factura asociada');
      }

      throw new BadRequestException('Only confirmed or processing orders can be invoiced');
    }

    // Un pedido se factura una sola vez: la factura queda enlazada por `invoices.orderId`.
    const [alreadyInvoiced] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.orderId, id))
      .limit(1);

    if (alreadyInvoiced) {
      throw new ConflictException('El pedido ya tiene una factura asociada');
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

    if (items.length === 0) {
      throw new BadRequestException('El pedido no tiene líneas para facturar');
    }

    const invoice = await this.billing.create(
      {
        partnerId: existing.partnerId,
        branchId: existing.branchId,
        currencyId: existing.currencyId ?? undefined,
        exchangeRate: existing.exchangeRate ? Number(existing.exchangeRate) : undefined,
        type: existing.type === 'PURCHASE' ? InvoiceType.PURCHASE : InvoiceType.SALE,
        orderId: existing.id,
        warehouseId: existing.warehouseId ?? undefined,
        items: items.map(item => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
      },
      userId ?? existing.userId ?? '',
      existing.branchId
    );

    await db
      .update(orders)
      .set({ status: OrderStatus.COMPLETED, updatedAt: new Date() })
      .where(eq(orders.id, id));

    await this.events.record({
      documentType: 'ORDER',
      documentId: id,
      documentCode: existing.code,
      action: 'ORDER_INVOICED',
      fromStatus: existing.status,
      toStatus: OrderStatus.COMPLETED,
      description: `Factura ${invoice.code}`,
      metadata: { invoiceId: invoice.id, invoiceCode: invoice.code },
      userId: userId ?? null,
      branchId: existing.branchId,
    });

    return {
      message: 'Factura creada como borrador a partir del pedido',
      orderId: id,
      invoiceId: invoice.id,
      invoiceCode: invoice.code,
    };
  }

  async getStats(branchId?: string): Promise<OrderStatsResponseDto> {
    const statsQuery = db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`.as('count'),
        totalSum: sql<string>`COALESCE(SUM(${orders.total}::numeric), 0)`.as('total_sum'),
      })
      .from(orders);

    const stats = await (branchId
      ? statsQuery.where(eq(orders.branchId, branchId)).groupBy(orders.status)
      : statsQuery.groupBy(orders.status));

    const formattedStats: OrderStatsResponseDto = {
      total: 0,
      draft: 0,
      confirmed: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
      totalRevenue: 0,
    };

    for (const stat of stats) {
      const count = Number(stat.count);
      const totalSum = Number(stat.totalSum) || 0;
      const statusUpper = (stat.status || 'DRAFT').toUpperCase();

      formattedStats.total += count;

      switch (statusUpper) {
        case 'DRAFT':
          formattedStats.draft = count;
          break;
        case 'CONFIRMED':
          formattedStats.confirmed = count;
          break;
        case 'PROCESSING':
          formattedStats.processing = count;
          break;
        case 'COMPLETED':
          formattedStats.completed = count;
          break;
        case 'CANCELLED':
          formattedStats.cancelled = count;
          break;
      }
    }

    const allRevenue = await db
      .select({
        totalSum: sql<string>`COALESCE(SUM(${orders.total}::numeric), 0)`.as('total_sum'),
      })
      .from(orders);

    formattedStats.totalRevenue = Number(allRevenue[0]?.totalSum) || 0;

    return formattedStats;
  }

  private async toResponseDto(
    order: typeof orders.$inferSelect,
    includeItems = false
  ): Promise<OrderResponseDto> {
    const response: OrderResponseDto = {
      id: order.id,
      code: order.code,
      partnerId: order.partnerId,
      branchId: order.branchId,
      warehouseId: order.warehouseId,
      type: (order.type as OrderResponseDto['type']) || 'SALE',
      status: (order.status as OrderStatus) || OrderStatus.DRAFT,
      total: order.total ? Number(order.total) : 0,
      exchangeRate: order.exchangeRate ? Number(order.exchangeRate) : null,
      currencyId: order.currencyId,
      date: order.date,
      userId: order.userId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    if (includeItems) {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

      response.items = items.map(item => this.toItemResponseDto(item));
    }

    return response;
  }

  private toItemResponseDto(item: typeof orderItems.$inferSelect): OrderItemResponseDto {
    return {
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      batchId: item.batchId,
      quantity: item.quantity ? Number(item.quantity) : 0,
      price: item.price ? Number(item.price) : 0,
    };
  }
}
