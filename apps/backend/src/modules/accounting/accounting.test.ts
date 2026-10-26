import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountingService } from './accounting.service';

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../database', () => ({
  db: mockDb,
}));

const createQueryBuilder = (data: any[]) => {
  const builder: any = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: Function) => resolve(data)),
  };
  return builder;
};

const setupSelectMock = (tableName: string, data: any[]) => {
  mockDb.select.mockReturnValue({
    from: vi.fn(() => createQueryBuilder(data)),
  });
};

describe('AccountingService', () => {
  let service: AccountingService;

  const mockAccount = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    code: '1.1.1.001',
    name: 'Caja General',
    type: 'ACTIVO',
    branchId: 'branch-1',
    parentId: null,
    isActive: true,
  };

  const mockAccount2 = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    code: '1.1.1.002',
    name: 'Bancos',
    type: 'ACTIVO',
    branchId: 'branch-1',
    parentId: '550e8400-e29b-41d4-a716-446655440001',
    isActive: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { AccountingService } = await import('./accounting.service');
    service = new AccountingService();
  });

  describe('findAllAccounts', () => {
    it('should return accounts in tree structure', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: Function) => resolve([mockAccount, mockAccount2])),
        })),
      });

      const result = await service.findAllAccounts();

      expect(result).toBeInstanceOf(Array);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty array when no accounts exist', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: Function) => resolve([])),
        })),
      });

      const result = await service.findAllAccounts();

      expect(result).toEqual([]);
    });
  });

  describe('findOneAccount', () => {
    it('should return account when found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: Function) => resolve([mockAccount])),
        })),
      });

      const result = await service.findOneAccount(mockAccount.id);

      expect(result).toMatchObject({
        id: mockAccount.id,
        code: mockAccount.code,
        name: mockAccount.name,
      });
    });

    it('should throw NotFoundException when account not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: Function) => resolve([])),
        })),
      });

      await expect(service.findOneAccount('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAccount', () => {
    it('should throw BadRequestException when account code already exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: Function) => resolve([mockAccount])),
        })),
      });

      await expect(
        service.createAccount({
          code: '1.1.1.001',
          name: 'Duplicate Account',
          type: 'ACTIVO' as any,
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createEntry', () => {
    it('should throw BadRequestException when debit/credit not balanced', async () => {
      await expect(
        service.createEntry({
          date: '2026-06-01T00:00:00.000Z',
          description: 'Unbalanced entry',
          lines: [
            { accountId: mockAccount.id, debit: 1000, credit: 0 },
            { accountId: mockAccount2.id, debit: 0, credit: 500 },
          ],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when entry has less than 2 lines', async () => {
      await expect(
        service.createEntry({
          date: '2026-06-01T00:00:00.000Z',
          description: 'Single line entry',
          lines: [{ accountId: mockAccount.id, debit: 1000, credit: 0 }],
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOneEntry', () => {
    it('should throw NotFoundException when entry not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: Function) => resolve([])),
        })),
      });

      await expect(service.findOneEntry('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllEntries', () => {
    it('should return entries', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: Function) => resolve([])),
        })),
      });

      const result = await service.findAllEntries({});

      expect(result).toBeInstanceOf(Array);
    });
  });
});
