import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../database', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    delete: mocks.mockDelete,
  },
}));

describe('InventoryService', () => {
  let service: InventoryService;

  const mockWarehouse = {
    id: 'warehouse-1',
    name: 'Main Warehouse',
    branchId: 'branch-1',
    address: '123 Main St',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMove = {
    id: 'move-1',
    code: 'INV-2026-00001',
    type: 'ENTRADA',
    status: 'EN_TRAMITE',
    source: 'MANUAL',
    fromWarehouseId: null,
    toWarehouseId: 'warehouse-1',
    note: 'Test move',
    userId: 'user-1',
    date: new Date(),
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMoveLine = {
    id: 'line-1',
    moveId: 'move-1',
    productId: 'product-1',
    batchId: 'batch-1',
    quantity: '50',
    cost: '10.50',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockQuery = (resolvedValue: any) => {
    const limitFn = vi.fn().mockResolvedValue(resolvedValue);
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    return {
      from: fromFn,
      where: whereFn,
      limit: limitFn,
      _resolvedValue: resolvedValue,
    };
  };

  beforeEach(() => {
    service = new InventoryService();
    vi.clearAllMocks();
  });

  describe('Warehouse operations', () => {
    it('findAllWarehouses - should return all warehouses', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([mockWarehouse]),
      });

      const result = await service.findAllWarehouses();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockWarehouse.id);
      expect(result[0].name).toBe(mockWarehouse.name);
    });

    it('findAllWarehouses - should return empty array when no warehouses', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      });

      const result = await service.findAllWarehouses();

      expect(result).toHaveLength(0);
    });

    it('findOneWarehouse - should return warehouse when found', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockWarehouse]),
          }),
        }),
      });

      const result = await service.findOneWarehouse('warehouse-1');

      expect(result.id).toBe(mockWarehouse.id);
    });

    it('findOneWarehouse - should throw NotFoundException when not found', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.findOneWarehouse('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('createWarehouse - should create new warehouse', async () => {
      const createDto = {
        name: 'New Warehouse',
        branchId: 'branch-1',
        address: '456 New St',
      };

      mocks.mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockWarehouse, ...createDto }]),
        }),
      });

      const result = await service.createWarehouse(createDto);

      expect(result.name).toBe(createDto.name);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('updateWarehouse - should throw NotFoundException for non-existent warehouse', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.updateWarehouse('non-existent', { name: 'New Name' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('Inventory Move creation validation', () => {
    it('should throw BadRequestException for SALIDA without fromWarehouseId', async () => {
      const createDto: any = {
        type: 'SALIDA',
        toWarehouseId: 'warehouse-1',
      };

      await expect(service.createMove(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for ENTRADA without toWarehouseId', async () => {
      const createDto: any = {
        type: 'ENTRADA',
        fromWarehouseId: 'warehouse-1',
      };

      await expect(service.createMove(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for TRANSFERENCIA without both warehouses', async () => {
      const createDto: any = {
        type: 'TRANSFERENCIA',
      };

      await expect(service.createMove(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for TRANSFERENCIA with only fromWarehouseId', async () => {
      const createDto: any = {
        type: 'TRANSFERENCIA',
        fromWarehouseId: 'warehouse-1',
      };

      await expect(service.createMove(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for TRANSFERENCIA with only toWarehouseId', async () => {
      const createDto: any = {
        type: 'TRANSFERENCIA',
        toWarehouseId: 'warehouse-2',
      };

      await expect(service.createMove(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Inventory Move approval/rejection validation', () => {
    it('approveMove - should throw NotFoundException when move not found', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.approveMove('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('approveMove - should throw BadRequestException when move already APPROVED', async () => {
      const approvedMove = { ...mockMove, status: 'APPROVED' };

      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([approvedMove]),
          }),
        }),
      });

      await expect(service.approveMove('move-1')).rejects.toThrow(BadRequestException);
    });

    it('approveMove - should throw BadRequestException when move already REJECTED', async () => {
      const rejectedMove = { ...mockMove, status: 'REJECTED' };

      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([rejectedMove]),
          }),
        }),
      });

      await expect(service.approveMove('move-1')).rejects.toThrow(BadRequestException);
    });

    it('rejectMove - should throw NotFoundException when move not found', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.rejectMove('non-existent', { reason: 'Invalid' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejectMove - should throw BadRequestException when move already APPROVED', async () => {
      const approvedMove = { ...mockMove, status: 'APPROVED' };

      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([approvedMove]),
          }),
        }),
      });

      await expect(service.rejectMove('move-1', { reason: 'Invalid' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejectMove - should throw BadRequestException when move already REJECTED', async () => {
      const rejectedMove = { ...mockMove, status: 'REJECTED' };

      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([rejectedMove]),
          }),
        }),
      });

      await expect(service.rejectMove('move-1', { reason: 'Invalid' })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('findOneMove', () => {
    it('should throw NotFoundException when move not found', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.findOneMove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findStockByWarehouse', () => {
    it('should throw NotFoundException when warehouse not found', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.findStockByWarehouse('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Edge cases', () => {
    it('should handle update with empty DTO', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockWarehouse]),
          }),
        }),
      });

      const result = await service.updateWarehouse('warehouse-1', {});

      expect(mocks.mockUpdate).not.toHaveBeenCalled();
      expect(result.name).toBe(mockWarehouse.name);
    });

    it('should handle update with only isActive', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockWarehouse]),
          }),
        }),
      });

      mocks.mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...mockWarehouse, isActive: true }]),
          }),
        }),
      });

      const result = await service.updateWarehouse('warehouse-1', { isActive: 1 });

      expect(result.isActive).toBe(true);
    });
  });
});
