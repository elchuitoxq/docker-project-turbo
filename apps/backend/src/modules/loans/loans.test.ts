import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LoansService } from './loans.service';
import { db } from '../../database';
import { loans, loanItems, partners } from '../../schema';
import { eq } from 'drizzle-orm';
import { CreateLoanDto, UpdateLoanDto, PayLoanDto, LoanStatus, LoanType } from './dto/loans.dto';

vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockPartner = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Test Partner',
  email: 'partner@test.com',
  taxId: 'J-12345678-9',
  address: 'Test Address',
  phone: '0412-1234567',
  type: 'CUSTOMER',
  taxpayerType: 'ORDINARY',
  retentionRate: '0',
  isSpecialTaxpayer: false,
  creditLimit: '10000',
  islrConceptId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockLoan = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  code: 'LOAN-2026-001',
  partnerId: mockPartner.id,
  status: LoanStatus.PENDING,
  startDate: null,
  dueDate: new Date('2026-12-31'),
  returnDate: null,
  notes: 'Test loan',
  createdAt: new Date(),
};

const mockLoanItem = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  loanId: mockLoan.id,
  productId: '550e8400-e29b-41d4-a716-446655440030',
  quantity: '5',
  serialNumber: 'SN-12345',
  condition: 'GOOD',
  kind: 'DELIVERED' as const,
};

/** Constructor de consultas encadenable que resuelve a `rows` en cualquier punto del await. */
const selectBuilder = (rows: any[]) =>
  ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue(Promise.resolve(rows)),
        then: (resolve: any) => Promise.resolve(rows).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      }),
      then: (resolve: any) => Promise.resolve(rows).then(resolve),
      [Symbol.toStringTag]: 'Promise',
    }),
    then: (resolve: any) => Promise.resolve(rows).then(resolve),
    [Symbol.toStringTag]: 'Promise',
  }) as any;

const createMockSelectQuery = (returnValue: any) => {
  const queryBuilder = {
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
  };
  vi.mocked(db).select.mockReturnValue(queryBuilder as any);
  return queryBuilder;
};

describe('LoansService', () => {
  let service: LoansService;

  beforeEach(() => {
    service = new LoansService();
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all loans without filters', async () => {
      createMockSelectQuery([mockLoan]);

      const result = await service.findAll({});

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe(mockLoan.code);
    });

    it('should filter loans by partnerId', async () => {
      createMockSelectQuery([mockLoan]);

      const result = await service.findAll({ employeeId: mockPartner.id });

      expect(result).toHaveLength(1);
    });

    it('should filter loans by status', async () => {
      createMockSelectQuery([mockLoan]);

      const result = await service.findAll({ status: LoanStatus.PENDING });

      expect(result).toHaveLength(1);
    });

    it('should filter loans by both partnerId and status', async () => {
      createMockSelectQuery([mockLoan]);

      const result = await service.findAll({
        employeeId: mockPartner.id,
        status: LoanStatus.PENDING,
      });

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no loans exist', async () => {
      createMockSelectQuery([]);

      const result = await service.findAll({});

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a loan with items when found', async () => {
      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const itemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockLoanItem]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockLoanItem]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockLoanItem]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockLoanItem]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(itemsQueryBuilder as any);

      const result = await service.findOne(mockLoan.id);

      expect(result.id).toBe(mockLoan.id);
      expect(result.code).toBe(mockLoan.code);
    });

    it('should throw NotFoundException when loan not found', async () => {
      createMockSelectQuery([]);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createLoanDto: CreateLoanDto = {
      code: 'LOAN-2026-002',
      partnerId: mockPartner.id,
      dueDate: '2026-12-31T23:59:59.000Z',
      notes: 'New loan',
      items: [
        {
          productId: '550e8400-e29b-41d4-a716-446655440030',
          quantity: 3,
          serialNumber: 'SN-001',
          condition: 'GOOD',
        },
      ],
    };

    it('should create a loan with items', async () => {
      const partnerQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const newLoan = { ...mockLoan, id: 'new-loan-id', code: createLoanDto.code };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(partnerQueryBuilder as any)
        .mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newLoan]),
        }),
      } as any);

      const result = await service.create(createLoanDto);

      expect(result.code).toBe(createLoanDto.code);
    });

    it('should create a loan without items', async () => {
      const dtoWithoutItems: CreateLoanDto = {
        code: 'LOAN-2026-003',
        partnerId: mockPartner.id,
      };

      const partnerQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const newLoan = { ...mockLoan, id: 'new-loan-id-2', code: dtoWithoutItems.code };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(partnerQueryBuilder as any)
        .mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newLoan]),
        }),
      } as any);

      const result = await service.create(dtoWithoutItems);

      expect(result.code).toBe(dtoWithoutItems.code);
    });

    it('should throw NotFoundException when partner not found', async () => {
      createMockSelectQuery([]);

      await expect(service.create(createLoanDto)).rejects.toThrow(NotFoundException);
    });

    it('should create loan with null dueDate when not provided', async () => {
      const dtoWithoutDueDate: CreateLoanDto = {
        code: 'LOAN-2026-004',
        partnerId: mockPartner.id,
      };

      const partnerQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const newLoan = {
        ...mockLoan,
        id: 'new-loan-id-3',
        code: dtoWithoutDueDate.code,
        dueDate: null,
      };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(partnerQueryBuilder as any)
        .mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newLoan]),
        }),
      } as any);

      const result = await service.create(dtoWithoutDueDate);

      expect(result.code).toBe(dtoWithoutDueDate.code);
    });
  });

  describe('update', () => {
    it('should update loan dueDate', async () => {
      const newDueDate = '2026-06-30T23:59:59.000Z';
      const updatedLoan = { ...mockLoan, dueDate: new Date(newDueDate) };

      const originalQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const updatedQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(originalQueryBuilder as any)
        .mockReturnValueOnce(updatedQueryBuilder as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await service.update(mockLoan.id, { dueDate: newDueDate });

      expect(result.dueDate).toBeInstanceOf(Date);
    });

    it('should update loan returnDate', async () => {
      const returnDate = '2026-06-15T23:59:59.000Z';
      const updatedLoan = { ...mockLoan, returnDate: new Date(returnDate) };

      const originalQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const updatedQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(originalQueryBuilder as any)
        .mockReturnValueOnce(updatedQueryBuilder as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await service.update(mockLoan.id, { returnDate });

      expect(result.returnDate).toBeInstanceOf(Date);
    });

    it('should update loan status', async () => {
      const updatedLoan = { ...mockLoan, status: LoanStatus.CANCELLED };

      const originalQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const updatedQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(originalQueryBuilder as any)
        .mockReturnValueOnce(updatedQueryBuilder as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await service.update(mockLoan.id, { status: LoanStatus.CANCELLED });

      expect(result.status).toBe(LoanStatus.CANCELLED);
    });

    it('should update loan notes', async () => {
      const updatedLoan = { ...mockLoan, notes: 'Updated notes' };

      const originalQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const updatedQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([updatedLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(originalQueryBuilder as any)
        .mockReturnValueOnce(updatedQueryBuilder as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await service.update(mockLoan.id, { notes: 'Updated notes' });

      expect(result.notes).toBe('Updated notes');
    });

    it('should throw NotFoundException when loan not found', async () => {
      const emptyQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db).select.mockReturnValue(emptyQueryBuilder as any);

      await expect(service.update('non-existent-id', { notes: 'test' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should not update when no fields provided', async () => {
      const mockQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db).select.mockReturnValue(mockQueryBuilder as any);

      const mockUpdate = vi.fn();
      vi.mocked(db).update.mockReturnValue({ set: mockUpdate } as any);

      await service.update(mockLoan.id, {});

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('should approve a pending loan', async () => {
      const pendingLoan = { ...mockLoan, status: LoanStatus.PENDING };

      const findQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const approvedLoan = { ...pendingLoan, status: LoanStatus.ACTIVE };
      const afterApproveQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([approvedLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([approvedLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([approvedLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([approvedLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(findQueryBuilder as any)
        .mockReturnValueOnce(afterApproveQueryBuilder as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await service.approve(mockLoan.id);

      expect(result.status).toBe(LoanStatus.ACTIVE);
    });

    it('should throw BadRequestException when loan is not PENDING', async () => {
      const activeLoan = { ...mockLoan, status: LoanStatus.ACTIVE };

      createMockSelectQuery([activeLoan]);

      await expect(service.approve(mockLoan.id)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when loan not found', async () => {
      createMockSelectQuery([]);

      await expect(service.approve('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('should reject a pending loan', async () => {
      const pendingLoan = { ...mockLoan, status: LoanStatus.PENDING };

      const findQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const rejectedLoan = { ...pendingLoan, status: LoanStatus.REJECTED };
      const afterRejectQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([rejectedLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([rejectedLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([rejectedLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([rejectedLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(findQueryBuilder as any)
        .mockReturnValueOnce(afterRejectQueryBuilder as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await service.reject(mockLoan.id);

      expect(result.status).toBe(LoanStatus.REJECTED);
    });

    it('should throw BadRequestException when loan is not PENDING', async () => {
      const activeLoan = { ...mockLoan, status: LoanStatus.ACTIVE };

      createMockSelectQuery([activeLoan]);

      await expect(service.reject(mockLoan.id)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when loan not found', async () => {
      createMockSelectQuery([]);

      await expect(service.reject('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('pay', () => {
    const payLoanDto: PayLoanDto = {
      items: [
        {
          productId: '550e8400-e29b-41d4-a716-446655440030',
          quantity: 2,
          serialNumber: 'SN-PAY-001',
          condition: 'GOOD',
        },
      ],
    };

    it('should record payment for an active loan', async () => {
      const activeLoan = { ...mockLoan, status: LoanStatus.ACTIVE };
      const returnedItem = { ...mockLoanItem, quantity: '1', kind: 'RETURNED' as const };

      vi.mocked(db).select.mockReset();
      vi.mocked(db)
        .select // prestamo
        .mockReturnValueOnce(selectBuilder([activeLoan]))
        // items tras registrar la devolucion (parcial: 1 de 5)
        .mockReturnValueOnce(selectBuilder([mockLoanItem, returnedItem]))
        // findOne
        .mockReturnValueOnce(selectBuilder([activeLoan]))
        // items de la respuesta
        .mockReturnValueOnce(selectBuilder([mockLoanItem, returnedItem]));

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);
      const updateSpy = vi.fn();
      vi.mocked(db).update.mockReturnValue(updateSpy as any);

      const result = await service.pay(mockLoan.id, payLoanDto);

      expect(result.status).toBe(LoanStatus.ACTIVE);
      expect(result.returnDate).toBeNull();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should close the loan when the return covers the delivered quantity', async () => {
      const activeLoan = { ...mockLoan, status: LoanStatus.ACTIVE };
      const closedLoan = { ...activeLoan, status: LoanStatus.PAID, returnDate: new Date() };
      const returnedItems = [
        mockLoanItem,
        { ...mockLoanItem, id: '550e8400-e29b-41d4-a716-446655440021', kind: 'RETURNED' as const },
      ];

      vi.mocked(db).select.mockReset();
      vi.mocked(db)
        .select.mockReturnValueOnce(selectBuilder([activeLoan]))
        .mockReturnValueOnce(selectBuilder(returnedItems))
        .mockReturnValueOnce(selectBuilder([closedLoan]))
        .mockReturnValueOnce(selectBuilder(returnedItems));

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const where = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({ where }),
      } as any);

      const result = await service.pay(mockLoan.id, payLoanDto);

      expect(result.status).toBe(LoanStatus.PAID);
      expect(result.returnDate).toBeInstanceOf(Date);
      expect(where).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when loan is not ACTIVE', async () => {
      const pendingLoan = { ...mockLoan, status: LoanStatus.PENDING };

      createMockSelectQuery([pendingLoan]);

      await expect(service.pay(mockLoan.id, payLoanDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when payment items are empty', async () => {
      const activeLoan = { ...mockLoan, status: LoanStatus.ACTIVE };

      createMockSelectQuery([activeLoan]);

      await expect(service.pay(mockLoan.id, { items: [] })).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when loan not found', async () => {
      createMockSelectQuery([]);

      await expect(service.pay('non-existent-id', payLoanDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('due date calculations', () => {
    it('should handle loan with past due date', async () => {
      const pastDueLoan = {
        ...mockLoan,
        dueDate: new Date('2020-01-01'),
        status: LoanStatus.ACTIVE,
      };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([pastDueLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([pastDueLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([pastDueLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([pastDueLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      const result = await service.findOne(mockLoan.id);

      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.dueDate!.getTime()).toBeLessThan(Date.now());
    });

    it('should handle loan with future due date', async () => {
      const futureDueLoan = {
        ...mockLoan,
        dueDate: new Date('2030-12-31'),
        status: LoanStatus.ACTIVE,
      };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([futureDueLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([futureDueLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([futureDueLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([futureDueLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      const result = await service.findOne(mockLoan.id);

      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.dueDate!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle loan with null due date', async () => {
      const noDueDateLoan = {
        ...mockLoan,
        dueDate: null,
        status: LoanStatus.PENDING,
      };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([noDueDateLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([noDueDateLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([noDueDateLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([noDueDateLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      const result = await service.findOne(mockLoan.id);

      expect(result.dueDate).toBeNull();
    });
  });

  describe('loan status transitions', () => {
    it('should transition from PENDING to ACTIVE on approve', async () => {
      const pendingLoan = { ...mockLoan, status: LoanStatus.PENDING };

      const findQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const approvedLoan = { ...pendingLoan, status: LoanStatus.ACTIVE };
      const afterApproveQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([approvedLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([approvedLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([approvedLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([approvedLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(findQueryBuilder as any)
        .mockReturnValueOnce(afterApproveQueryBuilder as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await service.approve(mockLoan.id);

      expect(result.status).toBe(LoanStatus.ACTIVE);
    });

    it('should transition from PENDING to REJECTED on reject', async () => {
      const pendingLoan = { ...mockLoan, status: LoanStatus.PENDING };

      const findQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([pendingLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const rejectedLoan = { ...pendingLoan, status: LoanStatus.REJECTED };
      const afterRejectQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([rejectedLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([rejectedLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([rejectedLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([rejectedLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(findQueryBuilder as any)
        .mockReturnValueOnce(afterRejectQueryBuilder as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await service.reject(mockLoan.id);

      expect(result.status).toBe(LoanStatus.REJECTED);
    });

    it('should not allow approve on already ACTIVE loan', async () => {
      const activeLoan = { ...mockLoan, status: LoanStatus.ACTIVE };

      createMockSelectQuery([activeLoan]);

      await expect(service.approve(mockLoan.id)).rejects.toThrow(BadRequestException);
    });

    it('should not allow reject on already REJECTED loan', async () => {
      const rejectedLoan = { ...mockLoan, status: LoanStatus.REJECTED };

      createMockSelectQuery([rejectedLoan]);

      await expect(service.reject(mockLoan.id)).rejects.toThrow(BadRequestException);
    });

    it('should not allow pay on PENDING loan', async () => {
      const pendingLoan = { ...mockLoan, status: LoanStatus.PENDING };

      createMockSelectQuery([pendingLoan]);

      const payDto: PayLoanDto = {
        items: [{ productId: 'prod-1', quantity: 1 }],
      };

      await expect(service.pay(mockLoan.id, payDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('loan return handling', () => {
    it('should set return date when updating loan', async () => {
      const returnDate = '2026-06-15T12:00:00.000Z';
      const returnedLoan = { ...mockLoan, returnDate: new Date(returnDate) };

      const originalQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const updatedQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([returnedLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([returnedLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([returnedLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([returnedLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(originalQueryBuilder as any)
        .mockReturnValueOnce(updatedQueryBuilder as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await service.update(mockLoan.id, { returnDate });

      expect(result.returnDate).toBeInstanceOf(Date);
    });

    it('should handle loan with both due date and return date', async () => {
      const loanWithBothDates = {
        ...mockLoan,
        dueDate: new Date('2026-06-01'),
        returnDate: new Date('2026-05-15'),
        status: LoanStatus.ACTIVE,
      };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([loanWithBothDates]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([loanWithBothDates]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([loanWithBothDates]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([loanWithBothDates]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      const result = await service.findOne(mockLoan.id);

      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.returnDate).toBeInstanceOf(Date);
      expect(result.returnDate!.getTime()).toBeLessThan(result.dueDate!.getTime());
    });

    it('should handle early return (return before due date)', async () => {
      const earlyReturnLoan = {
        ...mockLoan,
        dueDate: new Date('2026-12-31'),
        returnDate: new Date('2026-06-01'),
        status: LoanStatus.ACTIVE,
      };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([earlyReturnLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([earlyReturnLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([earlyReturnLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([earlyReturnLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      const result = await service.findOne(mockLoan.id);

      expect(result.returnDate!.getTime()).toBeLessThan(result.dueDate!.getTime());
    });

    it('should handle late return (return after due date)', async () => {
      const lateReturnLoan = {
        ...mockLoan,
        dueDate: new Date('2026-05-01'),
        returnDate: new Date('2026-06-01'),
        status: LoanStatus.ACTIVE,
      };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([lateReturnLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([lateReturnLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([lateReturnLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([lateReturnLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      const result = await service.findOne(mockLoan.id);

      expect(result.returnDate!.getTime()).toBeGreaterThan(result.dueDate!.getTime());
    });
  });

  describe('edge cases', () => {
    it('should handle multiple loan items', async () => {
      const createDto: CreateLoanDto = {
        code: 'LOAN-2026-MULTI',
        partnerId: mockPartner.id,
        items: [
          { productId: 'prod-1', quantity: 5, serialNumber: 'SN-001' },
          { productId: 'prod-2', quantity: 3, serialNumber: 'SN-002' },
          { productId: 'prod-3', quantity: 10, serialNumber: 'SN-003' },
        ],
      };

      const partnerQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const newLoan = {
        ...mockLoan,
        id: 'new-multi-loan',
        code: createDto.code,
      };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(partnerQueryBuilder as any)
        .mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newLoan]),
        }),
      } as any);

      const result = await service.create(createDto);

      expect(result.code).toBe(createDto.code);
    });

    it('should handle item with default condition', async () => {
      const createDto: CreateLoanDto = {
        code: 'LOAN-2026-NO-COND',
        partnerId: mockPartner.id,
        items: [{ productId: 'prod-1', quantity: 1 }],
      };

      const partnerQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const newLoan = { ...mockLoan, id: 'new-no-cond-loan', code: createDto.code };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(partnerQueryBuilder as any)
        .mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newLoan]),
        }),
      } as any);

      const result = await service.create(createDto);

      expect(result.code).toBe(createDto.code);
    });

    it('should handle zero quantity item', async () => {
      const createDto: CreateLoanDto = {
        code: 'LOAN-2026-ZERO-QTY',
        partnerId: mockPartner.id,
        items: [{ productId: 'prod-1', quantity: 0 }],
      };

      const partnerQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([mockPartner]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const newLoan = { ...mockLoan, id: 'new-zero-qty-loan', code: createDto.code };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([newLoan]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(partnerQueryBuilder as any)
        .mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newLoan]),
        }),
      } as any);

      const result = await service.create(createDto);

      expect(result.code).toBe(createDto.code);
    });

    it('should handle all loan statuses in findAll', async () => {
      const allStatusLoans = [
        { ...mockLoan, id: '1', status: LoanStatus.PENDING },
        { ...mockLoan, id: '2', status: LoanStatus.ACTIVE },
        { ...mockLoan, id: '3', status: LoanStatus.REJECTED },
        { ...mockLoan, id: '4', status: LoanStatus.PAID },
        { ...mockLoan, id: '5', status: LoanStatus.CANCELLED },
      ];

      createMockSelectQuery(allStatusLoans);

      const result = await service.findAll({});

      expect(result).toHaveLength(5);
    });

    it('should handle very long notes', async () => {
      const longNotes = 'A'.repeat(10000);
      const loanWithLongNotes = { ...mockLoan, notes: longNotes };

      const loanQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([loanWithLongNotes]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([loanWithLongNotes]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([loanWithLongNotes]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([loanWithLongNotes]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      const emptyItemsQueryBuilder = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve([]).then(resolve),
              [Symbol.toStringTag]: 'Promise',
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
            [Symbol.toStringTag]: 'Promise',
          }),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
          [Symbol.toStringTag]: 'Promise',
        }),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
        [Symbol.toStringTag]: 'Promise',
      };

      vi.mocked(db)
        .select.mockReturnValueOnce(loanQueryBuilder as any)
        .mockReturnValueOnce(emptyItemsQueryBuilder as any);

      const result = await service.findOne(mockLoan.id);

      expect(result.notes).toBe(longNotes);
      expect(result.notes!.length).toBe(10000);
    });
  });

  describe('LoanStatus enum validation', () => {
    it('should have all expected statuses', () => {
      expect(LoanStatus.PENDING).toBe('PENDING');
      expect(LoanStatus.ACTIVE).toBe('ACTIVE');
      expect(LoanStatus.REJECTED).toBe('REJECTED');
      expect(LoanStatus.PAID).toBe('PAID');
      expect(LoanStatus.CANCELLED).toBe('CANCELLED');
    });

    it('should have all expected loan types', () => {
      expect(LoanType.QUOTA).toBe('QUOTA');
      expect(LoanType.ADVANCE).toBe('ADVANCE');
    });
  });
});
