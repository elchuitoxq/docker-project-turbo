import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database';
import { orders, orderItems } from '../../schema';
import { eq, sql, and, like } from 'drizzle-orm';
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
  async findAll(status?: OrderStatus, partnerId?: string): Promise<OrderResponseDto[]> {
    let query = db.select().from(orders);

    const conditions = [];

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
    return Promise.all(allOrders.map(order => this.toResponseDto(order)));
  }

  async findOne(id: string): Promise<OrderResponseDto> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return this.toResponseDto(order, true);
  }

  async create(createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.code, createOrderDto.code))
      .limit(1);

    if (existingOrder) {
      throw new BadRequestException(`Order with code ${createOrderDto.code} already exists`);
    }

    const total = createOrderDto.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    const [newOrder] = await db
      .insert(orders)
      .values({
        code: createOrderDto.code,
        partnerId: createOrderDto.partnerId,
        branchId: createOrderDto.branchId,
        warehouseId: createOrderDto.warehouseId,
        type: createOrderDto.type || 'SALE',
        status: OrderStatus.DRAFT,
        total: total.toString(),
        exchangeRate: createOrderDto.exchangeRate?.toString() || '1',
        currencyId: createOrderDto.currencyId,
        date: createOrderDto.date ? new Date(createOrderDto.date) : new Date(),
      })
      .returning();

    for (const item of createOrderDto.items) {
      await db.insert(orderItems).values({
        orderId: newOrder.id,
        productId: item.productId,
        batchId: item.batchId,
        quantity: item.quantity.toString(),
        price: item.price.toString(),
      });
    }

    return this.findOne(newOrder.id);
  }

  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<OrderResponseDto> {
    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (existing.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled order');
    }

    if (existing.status !== OrderStatus.DRAFT) {
      if (
        updateOrderDto.status !== undefined ||
        updateOrderDto.exchangeRate !== undefined ||
        updateOrderDto.currencyId !== undefined
      ) {
        throw new BadRequestException('Can only update warehouseId and date for non-draft orders');
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
    }

    if (updateOrderDto.exchangeRate !== undefined) {
      updateData.exchangeRate = updateOrderDto.exchangeRate.toString();
    }

    if (updateOrderDto.date !== undefined) {
      updateData.date = new Date(updateOrderDto.date);
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db.update(orders).set(updateData).where(eq(orders.id, id));
    }

    return this.findOne(id);
  }

  async confirm(id: string): Promise<ConfirmOrderResponseDto> {
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

    return {
      id,
      status: OrderStatus.CONFIRMED,
      message: 'Order confirmed successfully',
    };
  }

  async cancel(id: string): Promise<CancelOrderResponseDto> {
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

    return {
      id,
      status: OrderStatus.CANCELLED,
      message: 'Order cancelled successfully',
    };
  }

  async invoice(id: string): Promise<{ message: string; orderId: string }> {
    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (existing.status !== OrderStatus.CONFIRMED && existing.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException('Only confirmed or processing orders can be invoiced');
    }

    return {
      message: 'Invoice functionality not yet implemented',
      orderId: id,
    };
  }

  async getStats(): Promise<OrderStatsResponseDto> {
    const stats = await db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`.as('count'),
        totalSum: sql<string>`COALESCE(SUM(${orders.total}::numeric), 0)`.as('total_sum'),
      })
      .from(orders)
      .groupBy(orders.status);

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
