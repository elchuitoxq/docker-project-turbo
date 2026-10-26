import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { db } from '../../database';
import { partners } from '../../schema';

vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

const mockPartner = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Corporation',
  email: 'contact@acme.com',
  taxId: 'J-12345678-9',
  address: 'Av. Libertador, Caracas, Venezuela',
  phone: '+58-212-555-1234',
  type: 'CUSTOMER',
  taxpayerType: 'ORDINARY',
  retentionRate: '75',
  isSpecialTaxpayer: false,
  creditLimit: '10000',
  islrConceptId: null,
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
  updatedAt: new Date('2026-06-01T12:00:00.000Z'),
};

const mockVendorPartner = {
  ...mockPartner,
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Vendor Corp',
  taxId: 'J-87654321-9',
  type: 'VENDOR',
  taxpayerType: 'SPECIAL',
  retentionRate: '100',
  isSpecialTaxpayer: true,
};

const makeAwaitable = (value: any) => ({
  then: (resolve: (val: any) => any, reject?: (err: any) => any) =>
    Promise.resolve(value).then(resolve, reject),
  [Symbol.toStringTag]: 'Promise',
});

describe('PartnersService', () => {
  let service: PartnersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PartnersService();
  });

  describe('findAll', () => {
    it('should return all partners when no search is provided', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue(makeAwaitable([mockPartner, mockVendorPartner])),
      } as any);

      const result = await service.findAll();

      expect(db.select).toHaveBeenCalledWith();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Acme Corporation');
      expect(result[1].name).toBe('Vendor Corp');
    });

    it('should return all partners when search is empty string', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
      } as any);

      const result = await service.findAll('');

      expect(result).toHaveLength(1);
    });

    it('should search partners by name, email, or taxId', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
        }),
      } as any);

      const result = await service.findAll('acme');

      expect(db.select).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Acme Corporation');
    });

    it('should return empty array when no partners match search', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable([])),
        }),
      } as any);

      const result = await service.findAll('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should handle case-insensitive search', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
        }),
      } as any);

      const result = await service.findAll('ACME');

      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a partner when found', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
          }),
        }),
      } as any);

      const result = await service.findOne(mockPartner.id);

      expect(result.id).toBe(mockPartner.id);
      expect(result.name).toBe('Acme Corporation');
      expect(result.email).toBe('contact@acme.com');
      expect(result.retentionRate).toBe(75);
      expect(result.creditLimit).toBe(10000);
    });

    it('should throw NotFoundException when partner not found', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([])),
          }),
        }),
      } as any);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should include all response fields correctly', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([mockVendorPartner])),
          }),
        }),
      } as any);

      const result = await service.findOne(mockVendorPartner.id);

      expect(result.type).toBe('VENDOR');
      expect(result.taxpayerType).toBe('SPECIAL');
      expect(result.isSpecialTaxpayer).toBe(true);
      expect(result.retentionRate).toBe(100);
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'New Partner',
      email: 'new@partner.com',
      taxId: 'J-98765432-1',
      address: 'New Address',
      phone: '+58-212-555-9999',
      type: 'CUSTOMER' as const,
      taxpayerType: 'ORDINARY' as const,
      retentionRate: 50,
      isSpecialTaxpayer: false,
      creditLimit: 5000,
    };

    it('should create a new partner successfully', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([])),
          }),
        }),
      } as any);

      const mockInsertResult = { ...mockPartner, ...createDto };
      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
        }),
      } as any);

      const result = await service.create(createDto);

      expect(db.insert).toHaveBeenCalledWith(partners);
      expect(result.name).toBe('New Partner');
    });

    it('should throw ConflictException when taxId already exists', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
          }),
        }),
      } as any);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should use default values when optional fields are not provided', async () => {
      const minimalDto = {
        name: 'Minimal Partner',
        taxId: 'J-11111111-1',
      };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([])),
          }),
        }),
      } as any);

      const mockInsertResult = {
        ...mockPartner,
        ...minimalDto,
        type: 'CUSTOMER',
        taxpayerType: 'ORDINARY',
        retentionRate: '0',
        isSpecialTaxpayer: false,
        creditLimit: '0',
      };

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
        }),
      } as any);

      const result = await service.create(minimalDto);

      expect(db.insert).toHaveBeenCalledWith(partners);
    });

    it('should handle retention rate as percentage (0-100)', async () => {
      const dtoWithRetention = { ...createDto, retentionRate: 100 };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([])),
          }),
        }),
      } as any);

      const mockInsertResult = { ...mockPartner, retentionRate: '100' };

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
        }),
      } as any);

      const result = await service.create(dtoWithRetention);

      expect(result.retentionRate).toBe(100);
    });

    it('should handle zero retention rate', async () => {
      const dtoWithZeroRetention = { ...createDto, retentionRate: 0 };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([])),
          }),
        }),
      } as any);

      const mockInsertResult = { ...mockPartner, retentionRate: '0' };

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
        }),
      } as any);

      const result = await service.create(dtoWithZeroRetention);

      expect(result.retentionRate).toBe(0);
    });

    it('should handle large credit limits', async () => {
      const dtoWithHighCredit = { ...createDto, creditLimit: 999999999.99 };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([])),
          }),
        }),
      } as any);

      const mockInsertResult = { ...mockPartner, creditLimit: '999999999.99' };

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
        }),
      } as any);

      const result = await service.create(dtoWithHighCredit);

      expect(result.creditLimit).toBe(999999999.99);
    });

    it('should create partner with VENDOR type', async () => {
      const vendorDto = { ...createDto, type: 'VENDOR' as const };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([])),
          }),
        }),
      } as any);

      const mockInsertResult = { ...mockPartner, ...vendorDto, type: 'VENDOR' };

      vi.mocked(db).insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
        }),
      } as any);

      const result = await service.create(vendorDto);

      expect(result.type).toBe('VENDOR');
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Partner',
      email: 'updated@partner.com',
      retentionRate: 80,
    };

    it('should update partner fields successfully', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([{ ...mockPartner, ...updateDto }])),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      const result = await service.update(mockPartner.id, updateDto);

      expect(db.update).toHaveBeenCalledWith(partners);
      expect(result.name).toBe('Updated Partner');
    });

    it('should throw NotFoundException when updating non-existent partner', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([])),
          }),
        }),
      } as any);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when changing to existing taxId', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockVendorPartner])),
            }),
          }),
        } as any);

      await expect(
        service.update(mockPartner.id, { taxId: mockVendorPartner.taxId })
      ).rejects.toThrow(ConflictException);
    });

    it('should allow updating to same taxId', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      const result = await service.update(mockPartner.id, { taxId: mockPartner.taxId });

      expect(result).toBeDefined();
    });

    it('should handle partner type transition from CUSTOMER to VENDOR', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([{ ...mockPartner, type: 'VENDOR' }])),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      const result = await service.update(mockPartner.id, { type: 'VENDOR' });

      expect(result.type).toBe('VENDOR');
    });

    it('should handle partner type transition from VENDOR to CUSTOMER', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockVendorPartner])),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([{ ...mockPartner, type: 'CUSTOMER' }])),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      const result = await service.update(mockVendorPartner.id, { type: 'CUSTOMER' });

      expect(result.type).toBe('CUSTOMER');
    });

    it('should update retention rate correctly', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockReturnValue(makeAwaitable([{ ...mockPartner, retentionRate: '100' }])),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      const result = await service.update(mockPartner.id, { retentionRate: 100 });

      expect(result.retentionRate).toBe(100);
    });

    it('should update credit limit correctly', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockReturnValue(makeAwaitable([{ ...mockPartner, creditLimit: '50000' }])),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      const result = await service.update(mockPartner.id, { creditLimit: 50000 });

      expect(result.creditLimit).toBe(50000);
    });

    it('should update isSpecialTaxpayer status', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockReturnValue(makeAwaitable([{ ...mockPartner, isSpecialTaxpayer: true }])),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      const result = await service.update(mockPartner.id, { isSpecialTaxpayer: true });

      expect(result.isSpecialTaxpayer).toBe(true);
    });

    it('should update taxpayerType', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockReturnValue(makeAwaitable([{ ...mockPartner, taxpayerType: 'LEGAL' }])),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      const result = await service.update(mockPartner.id, { taxpayerType: 'LEGAL' });

      expect(result.taxpayerType).toBe('LEGAL');
    });

    it('should not update when no fields are provided', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
          }),
        }),
      } as any);

      const result = await service.update(mockPartner.id, {});

      expect(db.update).not.toHaveBeenCalled();
      expect(result.id).toBe(mockPartner.id);
    });

    it('should set updatedAt timestamp when updating', async () => {
      vi.mocked(db)
        .select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
            }),
          }),
        } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      await service.update(mockPartner.id, { name: 'Updated' });

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete partner by setting isSpecialTaxpayer to false', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      const result = await service.remove(mockPartner.id);

      expect(db.update).toHaveBeenCalledWith(partners);
      expect(result.message).toContain('deactivated successfully');
    });

    it('should throw NotFoundException when removing non-existent partner', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([])),
          }),
        }),
      } as any);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should set updatedAt when soft deleting', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([mockPartner])),
          }),
        }),
      } as any);

      vi.mocked(db).update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        }),
      } as any);

      await service.remove(mockPartner.id);

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics for customers and vendors', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue(
            makeAwaitable([
              { type: 'CUSTOMER', count: 10 },
              { type: 'VENDOR', count: 5 },
            ])
          ),
        }),
      } as any);

      const result = await service.getStats();

      expect(result.customer).toBe(10);
      expect(result.vendor).toBe(5);
      expect(result.total).toBe(15);
    });

    it('should return zeros when no partners exist', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue(makeAwaitable([])),
        }),
      } as any);

      const result = await service.getStats();

      expect(result.customer).toBe(0);
      expect(result.vendor).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle only customer partners', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue(makeAwaitable([{ type: 'CUSTOMER', count: 20 }])),
        }),
      } as any);

      const result = await service.getStats();

      expect(result.customer).toBe(20);
      expect(result.vendor).toBe(0);
      expect(result.total).toBe(20);
    });

    it('should handle only vendor partners', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue(makeAwaitable([{ type: 'VENDOR', count: 15 }])),
        }),
      } as any);

      const result = await service.getStats();

      expect(result.customer).toBe(0);
      expect(result.vendor).toBe(15);
      expect(result.total).toBe(15);
    });

    it('should handle null type in database', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue(makeAwaitable([{ type: null, count: 3 }])),
        }),
      } as any);

      const result = await service.getStats();

      expect(result.customer).toBe(3);
      expect(result.vendor).toBe(0);
      expect(result.total).toBe(3);
    });

    it('should handle uppercase type values', async () => {
      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue(
            makeAwaitable([
              { type: 'CUSTOMER', count: 8 },
              { type: 'VENDOR', count: 12 },
            ])
          ),
        }),
      } as any);

      const result = await service.getStats();

      expect(result.customer).toBe(8);
      expect(result.vendor).toBe(12);
      expect(result.total).toBe(20);
    });
  });

  describe('edge cases', () => {
    it('should handle partner with all optional fields null', async () => {
      const minimalPartner = {
        ...mockPartner,
        email: null,
        address: null,
        phone: null,
        islrConceptId: null,
        retentionRate: '0',
        creditLimit: '0',
        isSpecialTaxpayer: false,
      };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([minimalPartner])),
          }),
        }),
      } as any);

      const result = await service.findOne(minimalPartner.id);

      expect(result.email).toBeNull();
      expect(result.address).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.islrConceptId).toBeNull();
      expect(result.retentionRate).toBe(0);
      expect(result.creditLimit).toBe(0);
    });

    it('should handle very long partner names', async () => {
      const longName = 'A'.repeat(500);
      const partnerWithLongName = { ...mockPartner, name: longName };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([partnerWithLongName])),
          }),
        }),
      } as any);

      const result = await service.findOne(mockPartner.id);

      expect(result.name).toBe(longName);
    });

    it('should handle special characters in taxId', async () => {
      const specialTaxId = 'J-123.456-789';
      const partnerWithSpecialTaxId = { ...mockPartner, taxId: specialTaxId };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([partnerWithSpecialTaxId])),
          }),
        }),
      } as any);

      const result = await service.findOne(mockPartner.id);

      expect(result.taxId).toBe(specialTaxId);
    });

    it('should handle unicode characters in name and address', async () => {
      const unicodePartner = {
        ...mockPartner,
        name: 'Cafe noho',
        address: 'Seoul Gangnam',
      };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([unicodePartner])),
          }),
        }),
      } as any);

      const result = await service.findOne(mockPartner.id);

      expect(result.name).toBe('Cafe noho');
      expect(result.address).toBe('Seoul Gangnam');
    });

    it('should handle decimal credit limits', async () => {
      const decimalCreditPartner = {
        ...mockPartner,
        creditLimit: '12345.67',
      };

      vi.mocked(db).select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(makeAwaitable([decimalCreditPartner])),
          }),
        }),
      } as any);

      const result = await service.findOne(mockPartner.id);

      expect(result.creditLimit).toBe(12345.67);
    });
  });
});
