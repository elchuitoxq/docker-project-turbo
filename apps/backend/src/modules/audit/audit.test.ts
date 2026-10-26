import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService, AuditLogResponseDto, AuditLogFilters } from './audit.service';
import { db } from '../../database';
import { auditLogs } from '../../schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

const mockAuditLog = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  entityTable: 'invoices',
  entityId: '550e8400-e29b-41d4-a716-446655440002',
  action: 'CREATE',
  changes: { field: 'status', oldValue: 'DRAFT', newValue: 'APPROVED' },
  userId: '550e8400-e29b-41d4-a716-446655440003',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  documentCode: 'INV-2026-0001',
  documentStatus: 'APPROVED',
  description: 'Invoice approved',
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
};

const mockAuditLog2 = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  entityTable: 'invoices',
  entityId: '550e8400-e29b-41d4-a716-446655440002',
  action: 'UPDATE',
  changes: { field: 'total', oldValue: '100.00', newValue: '150.00' },
  userId: '550e8400-e29b-41d4-a716-446655440005',
  ipAddress: '192.168.1.2',
  userAgent: 'Chrome/120.0',
  documentCode: 'INV-2026-0001',
  documentStatus: 'APPROVED',
  description: 'Invoice total updated',
  createdAt: new Date('2026-06-02T14:30:00.000Z'),
};

const mockAuditLog3 = {
  id: '550e8400-e29b-41d4-a716-446655440006',
  entityTable: 'orders',
  entityId: '550e8400-e29b-41d4-a716-446655440007',
  action: 'CREATE',
  changes: null,
  userId: '550e8400-e29b-41d4-a716-446655440003',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  documentCode: null,
  documentStatus: null,
  description: 'New order created',
  createdAt: new Date('2026-06-01T10:00:00.000Z'),
};

const setupSelectMock = (returnValue: any) => {
  vi.mocked(db).select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
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

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditService();
  });

  describe('findByEntity', () => {
    it('should return audit logs for a specific entity', async () => {
      setupSelectMock([mockAuditLog, mockAuditLog2]);

      const result = await service.findByEntity('invoices', '550e8400-e29b-41d4-a716-446655440002');

      expect(result).toHaveLength(2);
      expect(result[0].entityTable).toBe('invoices');
      expect(result[0].entityId).toBe('550e8400-e29b-41d4-a716-446655440002');
      expect(result[0].action).toBe('CREATE');
    });

    it('should return empty array when no audit logs found for entity', async () => {
      setupSelectMock([]);

      const result = await service.findByEntity(
        'nonexistent',
        '550e8400-e29b-41d4-a716-446655440999'
      );

      expect(result).toHaveLength(0);
    });

    it('should return logs ordered by createdAt descending', async () => {
      setupSelectMock([mockAuditLog2, mockAuditLog]);

      const result = await service.findByEntity('invoices', '550e8400-e29b-41d4-a716-446655440002');

      expect(result[0].id).toBe(mockAuditLog2.id);
      expect(result[1].id).toBe(mockAuditLog.id);
    });

    it('should correctly map all fields to response DTO', async () => {
      setupSelectMock([mockAuditLog]);

      const result = await service.findByEntity('invoices', '550e8400-e29b-41d4-a716-446655440002');

      expect(result[0]).toEqual({
        id: mockAuditLog.id,
        entityTable: mockAuditLog.entityTable,
        entityId: mockAuditLog.entityId,
        action: mockAuditLog.action,
        changes: mockAuditLog.changes,
        userId: mockAuditLog.userId,
        ipAddress: mockAuditLog.ipAddress,
        userAgent: mockAuditLog.userAgent,
        documentCode: mockAuditLog.documentCode,
        documentStatus: mockAuditLog.documentStatus,
        description: mockAuditLog.description,
        createdAt: mockAuditLog.createdAt,
      });
    });

    it('should handle logs with null optional fields', async () => {
      const logWithNulls = {
        ...mockAuditLog,
        userId: null,
        ipAddress: null,
        userAgent: null,
        documentCode: null,
        documentStatus: null,
        description: null,
        changes: null,
      };
      setupSelectMock([logWithNulls]);

      const result = await service.findByEntity('invoices', '550e8400-e29b-41d4-a716-446655440002');

      expect(result[0].userId).toBeNull();
      expect(result[0].ipAddress).toBeNull();
      expect(result[0].userAgent).toBeNull();
      expect(result[0].documentCode).toBeNull();
      expect(result[0].documentStatus).toBeNull();
      expect(result[0].description).toBeNull();
      expect(result[0].changes).toBeNull();
    });

    it('should filter by entityTable correctly', async () => {
      setupSelectMock([mockAuditLog3]);

      const result = await service.findByEntity('orders', '550e8400-e29b-41d4-a716-446655440007');

      expect(result).toHaveLength(1);
      expect(result[0].entityTable).toBe('orders');
      expect(result[0].action).toBe('CREATE');
    });
  });

  describe('findAll', () => {
    it('should return all audit logs without filters', async () => {
      setupSelectMock([mockAuditLog, mockAuditLog2, mockAuditLog3]);

      const result = await service.findAll({});

      expect(result).toHaveLength(3);
    });

    it('should return empty array when no audit logs exist', async () => {
      setupSelectMock([]);

      const result = await service.findAll({});

      expect(result).toHaveLength(0);
    });

    it('should filter by userId', async () => {
      setupSelectMock([mockAuditLog, mockAuditLog3]);

      const result = await service.findAll({ userId: '550e8400-e29b-41d4-a716-446655440003' });

      expect(result).toHaveLength(2);
      expect(result.every(log => log.userId === '550e8400-e29b-41d4-a716-446655440003')).toBe(true);
    });

    it('should filter by entityTable', async () => {
      setupSelectMock([mockAuditLog, mockAuditLog2]);

      const result = await service.findAll({ entityTable: 'invoices' });

      expect(result).toHaveLength(2);
      expect(result.every(log => log.entityTable === 'invoices')).toBe(true);
    });

    it('should filter by from date', async () => {
      const fromDate = new Date('2026-06-01T13:00:00.000Z');
      setupSelectMock([mockAuditLog2]);

      const result = await service.findAll({ from: fromDate });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockAuditLog2.id);
    });

    it('should filter by to date', async () => {
      const toDate = new Date('2026-06-01T13:00:00.000Z');
      setupSelectMock([mockAuditLog, mockAuditLog3]);

      const result = await service.findAll({ to: toDate });

      expect(result).toHaveLength(2);
    });

    it('should filter by from and to date combined', async () => {
      const fromDate = new Date('2026-06-01T00:00:00.000Z');
      const toDate = new Date('2026-06-02T00:00:00.000Z');
      setupSelectMock([mockAuditLog]);

      const result = await service.findAll({ from: fromDate, to: toDate });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockAuditLog.id);
    });

    it('should filter by userId and entityTable combined', async () => {
      setupSelectMock([mockAuditLog]);

      const result = await service.findAll({
        userId: '550e8400-e29b-41d4-a716-446655440003',
        entityTable: 'invoices',
      });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('550e8400-e29b-41d4-a716-446655440003');
      expect(result[0].entityTable).toBe('invoices');
    });

    it('should filter by all filters combined', async () => {
      const fromDate = new Date('2026-06-01T00:00:00.000Z');
      const toDate = new Date('2026-06-03T00:00:00.000Z');
      setupSelectMock([mockAuditLog]);

      const result = await service.findAll({
        userId: '550e8400-e29b-41d4-a716-446655440003',
        entityTable: 'invoices',
        from: fromDate,
        to: toDate,
      });

      expect(result).toHaveLength(1);
    });

    it('should return results ordered by createdAt descending', async () => {
      setupSelectMock([mockAuditLog2, mockAuditLog, mockAuditLog3]);

      const result = await service.findAll({});

      expect(result[0].id).toBe(mockAuditLog2.id);
      expect(result[1].id).toBe(mockAuditLog.id);
      expect(result[2].id).toBe(mockAuditLog3.id);
    });
  });

  describe('AuditLogFilters edge cases', () => {
    it('should handle filter with non-existent userId returning empty', async () => {
      setupSelectMock([]);

      const result = await service.findAll({ userId: 'non-existent-user-id' });

      expect(result).toHaveLength(0);
    });

    it('should handle filter with non-existent entityTable returning empty', async () => {
      setupSelectMock([]);

      const result = await service.findAll({ entityTable: 'nonexistent_table' });

      expect(result).toHaveLength(0);
    });

    it('should handle date range with no matching results', async () => {
      const fromDate = new Date('2027-01-01T00:00:00.000Z');
      const toDate = new Date('2027-12-31T23:59:59.000Z');
      setupSelectMock([]);

      const result = await service.findAll({ from: fromDate, to: toDate });

      expect(result).toHaveLength(0);
    });

    it('should handle from date after to date gracefully', async () => {
      const fromDate = new Date('2026-12-31T00:00:00.000Z');
      const toDate = new Date('2026-01-01T00:00:00.000Z');
      setupSelectMock([]);

      const result = await service.findAll({ from: fromDate, to: toDate });

      expect(result).toHaveLength(0);
    });
  });

  describe('AuditLogResponseDto mapping', () => {
    it('should preserve JSON changes correctly', async () => {
      const complexChanges = {
        items: [
          { productId: 'prod-1', quantity: 5, price: 100 },
          { productId: 'prod-2', quantity: 3, price: 50 },
        ],
        totals: { subtotal: 650, tax: 104, total: 754 },
      };
      const logWithComplexChanges = { ...mockAuditLog, changes: complexChanges };
      setupSelectMock([logWithComplexChanges]);

      const result = await service.findByEntity('invoices', mockAuditLog.entityId);

      expect(result[0].changes).toEqual(complexChanges);
    });

    it('should handle unicode characters in description', async () => {
      const logWithUnicode = {
        ...mockAuditLog,
        description: 'Invoice created with special chars: áéíóú ñ 中文 🔥',
      };
      setupSelectMock([logWithUnicode]);

      const result = await service.findByEntity('invoices', mockAuditLog.entityId);

      expect(result[0].description).toBe(logWithUnicode.description);
    });

    it('should handle very long document codes', async () => {
      const longCode = 'INV-' + '0'.repeat(100) + '-0001';
      const logWithLongCode = { ...mockAuditLog, documentCode: longCode };
      setupSelectMock([logWithLongCode]);

      const result = await service.findByEntity('invoices', mockAuditLog.entityId);

      expect(result[0].documentCode).toBe(longCode);
    });
  });

  describe('Multiple entities handling', () => {
    it('should handle finding logs for multiple different entities', async () => {
      setupSelectMock([mockAuditLog]);

      const invoiceResult = await service.findByEntity('invoices', mockAuditLog.entityId);
      expect(invoiceResult).toHaveLength(1);

      vi.clearAllMocks();
      setupSelectMock([mockAuditLog3]);

      const orderResult = await service.findByEntity('orders', mockAuditLog3.entityId);
      expect(orderResult).toHaveLength(1);
      expect(orderResult[0].entityTable).toBe('orders');
    });

    it('should differentiate between entityTable and entityId correctly', async () => {
      const differentEntityId = '550e8400-e29b-41d4-a716-446655440999';
      setupSelectMock([]);

      const result = await service.findByEntity('invoices', differentEntityId);

      expect(result).toHaveLength(0);
    });
  });

  describe('Performance and edge case data', () => {
    it('should handle large number of audit logs', async () => {
      const manyLogs = Array.from({ length: 100 }, (_, i) => ({
        ...mockAuditLog,
        id: `log-${i}`,
        createdAt: new Date(`2026-06-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z`),
      }));
      setupSelectMock(manyLogs);

      const result = await service.findAll({});

      expect(result).toHaveLength(100);
    });

    it('should handle concurrent calls gracefully', async () => {
      setupSelectMock([mockAuditLog]);

      const [result1, result2] = await Promise.all([
        service.findByEntity('invoices', mockAuditLog.entityId),
        service.findAll({ userId: mockAuditLog.userId }),
      ]);

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
    });

    it('should handle very old dates in from filter', async () => {
      const veryOldDate = new Date('2020-01-01T00:00:00.000Z');
      setupSelectMock([mockAuditLog, mockAuditLog2, mockAuditLog3]);

      const result = await service.findAll({ from: veryOldDate });

      expect(result).toHaveLength(3);
    });

    it('should handle future dates in to filter', async () => {
      const futureDate = new Date('2030-12-31T23:59:59.000Z');
      setupSelectMock([mockAuditLog, mockAuditLog2, mockAuditLog3]);

      const result = await service.findAll({ to: futureDate });

      expect(result).toHaveLength(3);
    });
  });
});
