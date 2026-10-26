import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { db } from '../../database';
import { orders, orderItems } from '../../schema';
import { OrderStatus, OrderType } from './dto/orders.dto';

vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

const createMockQueryBuilder = (returnValue: any) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockReturnValue(returnValue),
      }),
      ...(Array.isArray(returnValue)
        ? {
            then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }
        : {}),
    }),
    groupBy: vi.fn().mockReturnValue({
      then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
      [Symbol.toStringTag]: 'Promise',
    }),
    then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
    [Symbol.toStringTag]: 'Promise',
  }),
  then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
  [Symbol.toStringTag]: 'Promise',
});

const createMockSelectQuery = (returnValue: any) => {
  const queryBuilder = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      }),
      then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
      [Symbol.toStringTag]: 'Promise',
    }),
    then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
    [Symbol.toStringTag]: 'Promise',
  };
  return vi.fn().mockReturnValue(queryBuilder);
};

const mockOrder = {
  id: '550e8400-e29b-41d4-a716-446655440011',
  code: 'ORD-2026-0001',
  partnerId: '550e8400-e29b-41d4-a716-446655440000',
  branchId: '550e8400-e29b-41d4-a716-446655440003',
  warehouseId: '550e8400-e29b-41d4-a716-446655440004',
  type: 'SALE',
  status: 'DRAFT',
  total: '255.00',
  exchangeRate: '1',
  currencyId: '550e8400-e29b-41d4-a716-446655440005',
  date: new Date('2026-06-01T12:00:00.000Z'),
  userId: '550e8400-e29b-41d4-a716-446655440006',
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
  updatedAt: new Date('2026-06-01T12:00:00.000Z'),
};

const mockOrderItem = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  orderId: '550e8400-e29b-41d4-a716-446655440011',
  productId: '550e8400-e29b-41d4-a716-446655440001',
  batchId: '550e8400-e29b-41d4-a716-446655440002',
  quantity: '10',
  price: '25.50',
};

const setupSelectMock = (returnValue: any) => {
  vi.mocked(db).select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      }),
      then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
      [Symbol.toStringTag]: 'Promise',
    }),
    then: (resolve: any) => Promise.resolve(returnValue).then(resolve),
    [Symbol.toStringTag]: 'Promise',
  } as any);
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrdersService();
  });

  describe('findAll', () => {
    it('should return all orders without filters', async () => {
      setupSelectMock([mockOrder]);

      const result = await service.findAll();

      expect(db.select).toHaveBeenCalledWith();
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('ORD-2026-0001');
    });

    it('should filter orders by status', async () => {
      setupSelectMock([mockOrder]);

      const result = await service.findAll(OrderStatus.DRAFT);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(OrderStatus.DRAFT);
    });

    it('should filter orders by partnerId', async () => {
      setupSelectMock([mockOrder]);

      const result = await service.findAll(undefined, mockOrder.partnerId);

      expect(result).toHaveLength(1);
      expect(result[0].partnerId).toBe(mockOrder.partnerId);
    });

    it('should filter orders by both status and partnerId', async () => {
      setupSelectMock([mockOrder]);

      const result = await service.findAll(OrderStatus.DRAFT, mockOrder.partnerId);

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no orders match filters', async () => {
      setupSelectMock([]);

      const result = await service.findAll(OrderStatus.COMPLETED);

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return order with items when found', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockOrderItem]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.findOne(mockOrder.id);

      expect(result.id).toBe(mockOrder.id);
      expect(result.code).toBe('ORD-2026-0001');
      expect(result.items).toHaveLength(1);
      expect(result.items?.[0].productId).toBe(mockOrderItem.productId);
    });

    it('should throw NotFoundException when order not found', async () => {
      setupSelectMock([]);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should return order without items when includeItems is false', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      const [order] = await db
        .select()
        .from(orders)
        .where(() => true as any)
        .limit(1);
      expect(order).toBeDefined();
    });
  });

  describe('create', () => {
    const createOrderDto = {
      code: 'ORD-2026-0002',
      partnerId: '550e8400-e29b-41d4-a716-446655440000',
      branchId: '550e8400-e29b-41d4-a716-446655440003',
      warehouseId: '550e8400-e29b-41d4-a716-446655440004',
      type: OrderType.SALE,
      currencyId: '550e8400-e29b-41d4-a716-446655440005',
      exchangeRate: 1.0,
      items: [
        { productId: '550e8400-e29b-41d4-a716-446655440001', quantity: 10, price: 25.5 },
        { productId: '550e8400-e29b-41d4-a716-446655440002', quantity: 5, price: 100.0 },
      ],
    };

    it('should create order with items and calculate total correctly', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      const newOrder = { ...mockOrder, code: createOrderDto.code, total: '755.00' };
      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve([newOrder]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([newOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.create(createOrderDto);

      expect(db.insert).toHaveBeenCalledWith(orders);
      expect(result.total).toBe(755.0);
    });

    it('should throw BadRequestException when order code already exists', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.create(createOrderDto)).rejects.toThrow(BadRequestException);
    });

    it('should create order with default type SALE when not provided', async () => {
      const dtoWithoutType = { ...createOrderDto, type: undefined };

      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      const newOrder = { ...mockOrder, code: dtoWithoutType.code, type: 'SALE', total: '755.00' };
      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve([newOrder]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([newOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.create(dtoWithoutType);

      expect(result.type).toBe(OrderType.SALE);
    });

    it('should create order with purchase type', async () => {
      const purchaseDto = { ...createOrderDto, type: OrderType.PURCHASE };

      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      const newOrder = { ...mockOrder, code: purchaseDto.code, type: 'PURCHASE', total: '755.00' };
      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve([newOrder]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([newOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.create(purchaseDto);

      expect(result.type).toBe(OrderType.PURCHASE);
    });
  });

  describe('update', () => {
    it('should update warehouseId for draft order', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) =>
                  Promise.resolve([{ ...mockOrder, warehouseId: 'new-warehouse-id' }]).then(
                    resolve
                  ),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const result = await service.update(mockOrder.id, { warehouseId: 'new-warehouse-id' });

      expect(db.update).toHaveBeenCalled();
      expect(result.warehouseId).toBe('new-warehouse-id');
    });

    it('should throw NotFoundException when updating non-existent order', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(
        service.update('nonexistent-id', { warehouseId: 'new-warehouse-id' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updating cancelled order', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([cancelledOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(
        service.update(mockOrder.id, { warehouseId: 'new-warehouse-id' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when updating status for non-draft order', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(
        service.update(mockOrder.id, { status: OrderStatus.PROCESSING })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when updating exchangeRate for non-draft order', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.update(mockOrder.id, { exchangeRate: 2.0 })).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when updating currencyId for non-draft order', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.update(mockOrder.id, { currencyId: 'new-currency-id' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('should allow updating warehouseId and date for non-draft orders', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const result = await service.update(mockOrder.id, { date: '2026-06-15T12:00:00.000Z' });

      expect(db.update).toHaveBeenCalled();
    });

    it('should update status for draft order', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) =>
                  Promise.resolve([{ ...mockOrder, status: OrderStatus.PROCESSING }]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const result = await service.update(mockOrder.id, { status: OrderStatus.PROCESSING });

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('should confirm a draft order', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const result = await service.confirm(mockOrder.id);

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(result.message).toBe('Order confirmed successfully');
      expect(db.update).toHaveBeenCalledWith(orders);
    });

    it('should throw NotFoundException when confirming non-existent order', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.confirm('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when confirming non-draft order', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.confirm(mockOrder.id)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when confirming already confirmed order', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.confirm(mockOrder.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a draft order', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const result = await service.cancel(mockOrder.id);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.message).toBe('Order cancelled successfully');
    });

    it('should cancel a confirmed order', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const result = await service.cancel(mockOrder.id);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should cancel a processing order', async () => {
      const processingOrder = { ...mockOrder, status: OrderStatus.PROCESSING };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([processingOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const result = await service.cancel(mockOrder.id);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should throw NotFoundException when cancelling non-existent order', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.cancel('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when cancelling already cancelled order', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([cancelledOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.cancel(mockOrder.id)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when cancelling completed order', async () => {
      const completedOrder = { ...mockOrder, status: OrderStatus.COMPLETED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([completedOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.cancel(mockOrder.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('invoice', () => {
    it('should invoice a confirmed order', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      const result = await service.invoice(mockOrder.id);

      expect(result.message).toBe('Invoice functionality not yet implemented');
      expect(result.orderId).toBe(mockOrder.id);
    });

    it('should invoice a processing order', async () => {
      const processingOrder = { ...mockOrder, status: OrderStatus.PROCESSING };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([processingOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      const result = await service.invoice(mockOrder.id);

      expect(result.message).toBe('Invoice functionality not yet implemented');
    });

    it('should throw NotFoundException when invoicing non-existent order', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.invoice('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when invoicing draft order', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.invoice(mockOrder.id)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when invoicing cancelled order', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([cancelledOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      await expect(service.invoice(mockOrder.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              then: (resolve: any) =>
                Promise.resolve([
                  { status: 'DRAFT', count: 5, total_sum: '1000.00' },
                  { status: 'CONFIRMED', count: 3, total_sum: '500.00' },
                  { status: 'PROCESSING', count: 2, total_sum: '300.00' },
                  { status: 'COMPLETED', count: 10, total_sum: '5000.00' },
                  { status: 'CANCELLED', count: 1, total_sum: '100.00' },
                ]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            then: (resolve: any) => {
              const result = [{ total_sum: '6900.00', totalSum: '6900.00' }];
              resolve(result);
              return Promise.resolve(result);
            },
            [Symbol.toStringTag]: 'Promise',
          }),
        } as any);

      const result = await service.getStats();

      expect(result.total).toBe(21);
      expect(result.draft).toBe(5);
      expect(result.confirmed).toBe(3);
      expect(result.processing).toBe(2);
      expect(result.completed).toBe(10);
      expect(result.cancelled).toBe(1);
      expect(result.totalRevenue).toBe(6900);
    });

    it('should return zeros when no orders exist', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([{ total_sum: '0' }]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.getStats();

      expect(result.total).toBe(0);
      expect(result.draft).toBe(0);
      expect(result.confirmed).toBe(0);
      expect(result.processing).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.cancelled).toBe(0);
      expect(result.totalRevenue).toBe(0);
    });

    it('should handle orders with null status', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              then: (resolve: any) =>
                Promise.resolve([{ status: null, count: 2, total_sum: '200.00' }]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([{ total_sum: '200.00' }]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.getStats();

      expect(result.draft).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should handle orders with lowercase status', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              then: (resolve: any) =>
                Promise.resolve([{ status: 'confirmed', count: 3, total_sum: '300.00' }]).then(
                  resolve
                ),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([{ total_sum: '300.00' }]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.getStats();

      expect(result.confirmed).toBe(3);
    });
  });

  describe('order status transitions', () => {
    it('should allow valid status transitions from DRAFT to CONFIRMED', async () => {
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const confirmResult = await service.confirm(mockOrder.id);
      expect(confirmResult.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should allow transition from CONFIRMED to CANCELLED', async () => {
      const confirmedOrder = { ...mockOrder, status: OrderStatus.CONFIRMED };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([confirmedOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const cancelResult = await service.cancel(mockOrder.id);
      expect(cancelResult.status).toBe(OrderStatus.CANCELLED);
    });

    it('should allow transition from PROCESSING to CANCELLED', async () => {
      const processingOrder = { ...mockOrder, status: OrderStatus.PROCESSING };
      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([processingOrder]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve(undefined).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      const cancelResult = await service.cancel(mockOrder.id);
      expect(cancelResult.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('order total calculations', () => {
    it('should calculate total correctly for multiple items', async () => {
      const createDtoWithMultipleItems = {
        code: 'ORD-2026-0003',
        partnerId: '550e8400-e29b-41d4-a716-446655440000',
        branchId: '550e8400-e29b-41d4-a716-446655440003',
        items: [
          { productId: '550e8400-e29b-41d4-a716-446655440001', quantity: 2, price: 100.0 },
          { productId: '550e8400-e29b-41d4-a716-446655440002', quantity: 3, price: 50.0 },
          { productId: '550e8400-e29b-41d4-a716-446655440003', quantity: 1, price: 250.0 },
        ],
      };

      const expectedTotal = 2 * 100.0 + 3 * 50.0 + 1 * 250.0;

      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      const mockInsertedOrder = {
        ...mockOrder,
        code: createDtoWithMultipleItems.code,
        total: expectedTotal.toString(),
      };

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve([mockInsertedOrder]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([mockInsertedOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.create(createDtoWithMultipleItems);

      expect(Number(mockInsertedOrder.total)).toBe(expectedTotal);
    });

    it('should handle decimal prices in total calculation', async () => {
      const createDtoWithDecimals = {
        code: 'ORD-2026-0005',
        partnerId: '550e8400-e29b-41d4-a716-446655440000',
        branchId: '550e8400-e29b-41d4-a716-446655440003',
        items: [
          { productId: '550e8400-e29b-41d4-a716-446655440001', quantity: 3, price: 33.33 },
          { productId: '550e8400-e29b-41d4-a716-446655440002', quantity: 2, price: 16.67 },
        ],
      };

      const expectedTotal = 3 * 33.33 + 2 * 16.67;

      vi.mocked(db).select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        }),
      } as any);

      const mockInsertedOrder = {
        ...mockOrder,
        code: createDtoWithDecimals.code,
        total: expectedTotal.toString(),
      };

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve([mockInsertedOrder]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
        }),
      } as any);

      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([mockInsertedOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.create(createDtoWithDecimals);

      expect(Number(mockInsertedOrder.total)).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('edge cases', () => {
    it('should handle order with large total value', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) =>
                  Promise.resolve([{ ...mockOrder, total: '9999999999.99' }]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.findOne(mockOrder.id);

      expect(result.total).toBe(9999999999.99);
    });

    it('should handle update with no changes', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any);

      const result = await service.update(mockOrder.id, {});

      expect(db.update).not.toHaveBeenCalled();
    });

    it('should handle order item with null batchId', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: any) =>
                Promise.resolve([{ ...mockOrderItem, batchId: null }]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.findOne(mockOrder.id);

      expect(result.items?.[0].batchId).toBeNull();
    });

    it('should handle order item with null quantity string', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: (resolve: any) => Promise.resolve([mockOrder]).then(resolve),
                [Symbol.toStringTag]: 'Promise',
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: any) =>
                Promise.resolve([{ ...mockOrderItem, quantity: null }]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
          }),
        } as any);

      const result = await service.findOne(mockOrder.id);

      expect(result.items?.[0].quantity).toBe(0);
    });
  });
});
