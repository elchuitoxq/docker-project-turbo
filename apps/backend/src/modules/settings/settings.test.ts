import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { CurrenciesService } from './currencies/currencies.service';
import { BanksService } from './banks/banks.service';
import { TaxConceptsService } from './tax-concepts/tax-concepts.service';
import { db } from '../../database';
import { currencies, exchangeRates, banks, taxConcepts } from '../../schema';

vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const makeAwaitable = (value: any) => ({
  then: (resolve: (val: any) => any, reject?: (err: any) => any) =>
    Promise.resolve(value).then(resolve, reject),
  [Symbol.toStringTag]: 'Promise',
});

describe('Settings Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CurrenciesService', () => {
    let service: CurrenciesService;

    const mockCurrency = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      isBase: false,
    };

    const mockCurrencyEUR = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      isBase: false,
    };

    const mockExchangeRate = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      currencyId: '550e8400-e29b-41d4-a716-446655440000',
      rate: '1.2345',
      date: new Date('2026-06-01T12:00:00.000Z'),
      source: 'MANUAL',
    };

    beforeEach(() => {
      vi.clearAllMocks();
      service = new CurrenciesService({ store: vi.fn() } as never);
    });

    describe('findAll', () => {
      it('should return all currencies', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([mockCurrency, mockCurrencyEUR])),
        } as any);

        const result = await service.findAll();

        expect(db.select).toHaveBeenCalledWith();
        expect(result).toHaveLength(2);
        expect(result[0].code).toBe('USD');
        expect(result[1].code).toBe('EUR');
      });

      it('should return empty array when no currencies exist', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([])),
        } as any);

        const result = await service.findAll();

        expect(result).toHaveLength(0);
      });

      it('should map all currency fields correctly', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([mockCurrency])),
        } as any);

        const result = await service.findAll();

        expect(result[0]).toEqual({
          id: mockCurrency.id,
          code: mockCurrency.code,
          name: mockCurrency.name,
          symbol: mockCurrency.symbol,
          isBase: false,
        });
      });
    });

    describe('findOne', () => {
      it('should return a currency when found', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockCurrency])),
            }),
          }),
        } as any);

        const result = await service.findOne(mockCurrency.id);

        expect(result.id).toBe(mockCurrency.id);
        expect(result.code).toBe('USD');
        expect(result.name).toBe('US Dollar');
      });

      it('should throw NotFoundException when currency not found', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
      });
    });

    describe('create', () => {
      const createDto = {
        code: 'GBP',
        name: 'British Pound',
        symbol: '£',
        isBase: false,
      };

      it('should create a new currency successfully', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        const mockInsertResult = { ...mockCurrency, ...createDto };
        vi.mocked(db).insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
          }),
        } as any);

        const result = await service.create(createDto);

        expect(db.insert).toHaveBeenCalledWith(currencies);
        expect(result.code).toBe('GBP');
      });

      it('should throw ConflictException when currency code already exists', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockCurrency])),
            }),
          }),
        } as any);

        await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      });

      it('should set isBase to false when not provided', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        const mockInsertResult = {
          ...mockCurrency,
          code: 'JPY',
          name: 'Japanese Yen',
          symbol: '¥',
          isBase: false,
        };
        vi.mocked(db).insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
          }),
        } as any);

        const result = await service.create({ code: 'JPY', name: 'Japanese Yen', symbol: '¥' });

        expect(result.isBase).toBe(false);
      });
    });

    describe('getLatestRates', () => {
      it('should return latest rates for each currency', async () => {
        const mockRatesData = [
          {
            ...mockExchangeRate,
            currencyCode: 'USD',
            currencyName: 'US Dollar',
            currencySymbol: '$',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            currencyId: '550e8400-e29b-41d4-a716-446655440001',
            rate: '0.85',
            date: new Date('2026-06-01T12:00:00.000Z'),
            source: 'MANUAL',
            currencyCode: 'EUR',
            currencyName: 'Euro',
            currencySymbol: '€',
          },
        ];

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue(makeAwaitable(mockRatesData)),
            }),
          }),
        } as any);

        const result = await service.getLatestRates();

        expect(result).toHaveLength(2);
        expect(result[0].currencyCode).toBe('USD');
        expect(result[1].currencyCode).toBe('EUR');
      });

      it('should return only the latest rate per currency when multiple exist', async () => {
        const mockNewRate = {
          ...mockExchangeRate,
          date: new Date('2026-06-01T12:00:00.000Z'),
        };
        const mockOldRate = {
          ...mockExchangeRate,
          date: new Date('2026-05-01T12:00:00.000Z'),
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue(makeAwaitable([mockNewRate, mockOldRate])),
            }),
          }),
        } as any);

        const result = await service.getLatestRates();

        expect(result).toHaveLength(1);
        expect(result[0].date).toEqual(mockNewRate.date);
      });

      it('should use MANUAL as default source', async () => {
        const mockRateNoSource = {
          ...mockExchangeRate,
          source: null,
          currencyCode: 'USD',
          currencyName: 'US Dollar',
          currencySymbol: '$',
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue(makeAwaitable([mockRateNoSource])),
            }),
          }),
        } as any);

        const result = await service.getLatestRates();

        expect(result[0].source).toBe('MANUAL');
      });
    });

    describe('addRate', () => {
      it('delegates the manual override to ExchangeRateService', async () => {
        const store = vi.fn().mockResolvedValue({
          id: 'rate-1',
          currencyId: 'usd-id',
          rate: 1.5,
          date: new Date('2026-10-26T00:00:00.000Z'),
          source: 'MANUAL',
        });
        const svc = new CurrenciesService({ store } as never);

        const result = await svc.addRate(
          { currencyCode: 'USD', rate: 1.5, reason: 'feriado bancario' },
          'user-1'
        );

        expect(store).toHaveBeenCalledWith(
          expect.objectContaining({
            currencyCode: 'USD',
            rate: 1.5,
            source: 'MANUAL',
            createdBy: 'user-1',
            reason: 'feriado bancario',
          })
        );
        expect(result.source).toBe('MANUAL');
      });

      it('resolves the currency code when only the id is provided', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([{ code: 'USD' }])),
            }),
          }),
        } as any);

        const store = vi.fn().mockResolvedValue({
          id: 'rate-1',
          currencyId: 'usd-id',
          rate: 1.5,
          date: new Date('2026-10-26T00:00:00.000Z'),
          source: 'MANUAL',
        });
        const svc = new CurrenciesService({ store } as never);

        await svc.addRate({ currencyId: '550e8400-e29b-41d4-a716-446655440000', rate: 1.5 });

        expect(store).toHaveBeenCalledWith(expect.objectContaining({ currencyCode: 'USD' }));
      });

      it('rejects a request without currencyCode or currencyId', async () => {
        const svc = new CurrenciesService({ store: vi.fn() } as never);

        await expect(svc.addRate({ rate: 1.5 } as never)).rejects.toThrow(BadRequestException);
      });

      it('throws NotFoundException when the currency id does not exist', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        const svc = new CurrenciesService({ store: vi.fn() } as never);

        await expect(
          svc.addRate({ currencyId: '550e8400-e29b-41d4-a716-446655440000', rate: 1.5 })
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('BanksService', () => {
    let service: BanksService;

    const mockBank = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      name: 'Banco de Venezuela',
      code: '0102',
      isActive: true,
      createdAt: new Date('2026-06-01T12:00:00.000Z'),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      service = new BanksService();
    });

    describe('findAll', () => {
      it('should return all banks', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([mockBank])),
        } as any);

        const result = await service.findAll();

        expect(db.select).toHaveBeenCalledWith();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Banco de Venezuela');
      });

      it('should return empty array when no banks exist', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([])),
        } as any);

        const result = await service.findAll();

        expect(result).toHaveLength(0);
      });
    });

    describe('findOne', () => {
      it('should return a bank when found', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockBank])),
            }),
          }),
        } as any);

        const result = await service.findOne(mockBank.id);

        expect(result.id).toBe(mockBank.id);
        expect(result.name).toBe('Banco de Venezuela');
        expect(result.code).toBe('0102');
      });

      it('should throw NotFoundException when bank not found', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
      });
    });

    describe('create', () => {
      const createDto = {
        name: 'Banco Provincial',
        code: '0104',
        isActive: true,
      };

      it('should create a new bank successfully', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        const mockInsertResult = { ...mockBank, ...createDto };
        vi.mocked(db).insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
          }),
        } as any);

        const result = await service.create(createDto);

        expect(db.insert).toHaveBeenCalledWith(banks);
        expect(result.name).toBe('Banco Provincial');
      });

      it('should throw ConflictException when bank code already exists', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockBank])),
            }),
          }),
        } as any);

        await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      });

      it('should default isActive to true when not provided', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        const mockInsertResult = {
          ...mockBank,
          name: 'Banco Mercantil',
          code: '0105',
          isActive: true,
        };
        vi.mocked(db).insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
          }),
        } as any);

        const result = await service.create({ name: 'Banco Mercantil', code: '0105' });

        expect(result.isActive).toBe(true);
      });
    });

    describe('update', () => {
      const updateDto = {
        name: 'Banco de Venezuela Actualizado',
        isActive: false,
      };

      it('should update bank fields successfully', async () => {
        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockBank])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([{ ...mockBank, ...updateDto }])),
              }),
            }),
          } as any);

        vi.mocked(db).update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
          }),
        } as any);

        const result = await service.update(mockBank.id, updateDto);

        expect(db.update).toHaveBeenCalledWith(banks);
        expect(result.name).toBe('Banco de Venezuela Actualizado');
      });

      it('should throw NotFoundException when updating non-existent bank', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
          NotFoundException
        );
      });

      it('should throw ConflictException when changing to existing code', async () => {
        const anotherBank = { ...mockBank, id: 'another-id', code: '0103' };

        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockBank])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([anotherBank])),
              }),
            }),
          } as any);

        await expect(service.update(mockBank.id, { code: '0103' })).rejects.toThrow(
          ConflictException
        );
      });

      it('should allow updating to same code', async () => {
        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockBank])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockBank])),
              }),
            }),
          } as any);

        vi.mocked(db).update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
          }),
        } as any);

        const result = await service.update(mockBank.id, { code: mockBank.code });

        expect(result).toBeDefined();
      });

      it('should not update when no fields are provided', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockBank])),
            }),
          }),
        } as any);

        const result = await service.update(mockBank.id, {});

        expect(db.update).not.toHaveBeenCalled();
        expect(result.id).toBe(mockBank.id);
      });
    });

    describe('toggle', () => {
      it('should toggle bank active status from true to false', async () => {
        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockBank])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([{ ...mockBank, isActive: false }])),
              }),
            }),
          } as any);

        vi.mocked(db).update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
          }),
        } as any);

        const result = await service.toggle(mockBank.id);

        expect(result.isActive).toBe(false);
      });

      it('should toggle bank active status from false to true', async () => {
        const inactiveBank = { ...mockBank, isActive: false };

        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([inactiveBank])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockReturnValue(makeAwaitable([{ ...inactiveBank, isActive: true }])),
              }),
            }),
          } as any);

        vi.mocked(db).update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
          }),
        } as any);

        const result = await service.toggle(mockBank.id);

        expect(result.isActive).toBe(true);
      });

      it('should throw NotFoundException when toggling non-existent bank', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        await expect(service.toggle('nonexistent-id')).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('TaxConceptsService', () => {
    let service: TaxConceptsService;

    const mockTaxConcept = {
      id: '550e8400-e29b-41d4-a716-446655440020',
      code: 'ISLR-001',
      name: 'Honorarios Profesionales',
      retentionPercentage: '75.00',
      baseMin: '0',
      sustraendo: '0',
      isEnabled: true,
    };

    beforeEach(() => {
      vi.clearAllMocks();
      service = new TaxConceptsService();
    });

    describe('findAll', () => {
      it('should return all tax concepts', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
        } as any);

        const result = await service.findAll();

        expect(db.select).toHaveBeenCalledWith();
        expect(result).toHaveLength(1);
        expect(result[0].code).toBe('ISLR-001');
      });

      it('should return empty array when no tax concepts exist', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([])),
        } as any);

        const result = await service.findAll();

        expect(result).toHaveLength(0);
      });
    });

    describe('findOne', () => {
      it('should return a tax concept when found', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
            }),
          }),
        } as any);

        const result = await service.findOne(mockTaxConcept.id);

        expect(result.id).toBe(mockTaxConcept.id);
        expect(result.code).toBe('ISLR-001');
        expect(result.retentionPercentage).toBe(75);
      });

      it('should throw NotFoundException when tax concept not found', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
      });
    });

    describe('create', () => {
      const createDto = {
        code: 'ISLR-002',
        name: 'Arrendamientos',
        retentionPercentage: 3,
        baseMin: 100,
        sustraendo: 0,
        isEnabled: true,
      };

      it('should create a new tax concept successfully', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        const mockInsertResult = { ...mockTaxConcept, ...createDto };
        vi.mocked(db).insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
          }),
        } as any);

        const result = await service.create(createDto);

        expect(db.insert).toHaveBeenCalledWith(taxConcepts);
        expect(result.code).toBe('ISLR-002');
      });

      it('should throw ConflictException when tax concept code already exists', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
            }),
          }),
        } as any);

        await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      });

      it('should default baseMin and sustraendo to 0 when not provided', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        const mockInsertResult = {
          ...mockTaxConcept,
          code: 'ISLR-003',
          name: 'Nuevo Concepto',
          retentionPercentage: '5.00',
          baseMin: '0',
          sustraendo: '0',
        };
        vi.mocked(db).insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
          }),
        } as any);

        const result = await service.create({
          code: 'ISLR-003',
          name: 'Nuevo Concepto',
          retentionPercentage: 5,
        });

        expect(result.baseMin).toBe(0);
        expect(result.sustraendo).toBe(0);
      });

      it('should default isEnabled to true when not provided', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        const mockInsertResult = {
          ...mockTaxConcept,
          code: 'ISLR-004',
          name: 'Otro Concepto',
          isEnabled: true,
        };
        vi.mocked(db).insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(makeAwaitable([mockInsertResult])),
          }),
        } as any);

        const result = await service.create({
          code: 'ISLR-004',
          name: 'Otro Concepto',
          retentionPercentage: 10,
        });

        expect(result.isEnabled).toBe(true);
      });
    });

    describe('update', () => {
      const updateDto = {
        name: 'Honorarios Profesionales Actualizado',
        retentionPercentage: 80,
      };

      it('should update tax concept fields successfully', async () => {
        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockReturnValue(makeAwaitable([{ ...mockTaxConcept, ...updateDto }])),
              }),
            }),
          } as any);

        vi.mocked(db).update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
          }),
        } as any);

        const result = await service.update(mockTaxConcept.id, updateDto);

        expect(db.update).toHaveBeenCalledWith(taxConcepts);
        expect(result.name).toBe('Honorarios Profesionales Actualizado');
        expect(result.retentionPercentage).toBe(80);
      });

      it('should throw NotFoundException when updating non-existent tax concept', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
          NotFoundException
        );
      });

      it('should throw ConflictException when changing to existing code', async () => {
        const anotherConcept = { ...mockTaxConcept, id: 'another-id', code: 'ISLR-999' };

        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([anotherConcept])),
              }),
            }),
          } as any);

        await expect(service.update(mockTaxConcept.id, { code: 'ISLR-999' })).rejects.toThrow(
          ConflictException
        );
      });

      it('should allow updating to same code', async () => {
        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
              }),
            }),
          } as any);

        vi.mocked(db).update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
          }),
        } as any);

        const result = await service.update(mockTaxConcept.id, { code: mockTaxConcept.code });

        expect(result).toBeDefined();
      });

      it('should not update when no fields are provided', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
            }),
          }),
        } as any);

        const result = await service.update(mockTaxConcept.id, {});

        expect(db.update).not.toHaveBeenCalled();
        expect(result.id).toBe(mockTaxConcept.id);
      });

      it('should update baseMin correctly', async () => {
        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockReturnValue(makeAwaitable([{ ...mockTaxConcept, baseMin: '1000' }])),
              }),
            }),
          } as any);

        vi.mocked(db).update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
          }),
        } as any);

        const result = await service.update(mockTaxConcept.id, { baseMin: 1000 });

        expect(result.baseMin).toBe(1000);
      });

      it('should update sustraendo correctly', async () => {
        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockReturnValue(makeAwaitable([{ ...mockTaxConcept, sustraendo: '500' }])),
              }),
            }),
          } as any);

        vi.mocked(db).update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
          }),
        } as any);

        const result = await service.update(mockTaxConcept.id, { sustraendo: 500 });

        expect(result.sustraendo).toBe(500);
      });

      it('should update isEnabled status', async () => {
        vi.mocked(db)
          .select.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
              }),
            }),
          } as any)
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockReturnValue(makeAwaitable([{ ...mockTaxConcept, isEnabled: false }])),
              }),
            }),
          } as any);

        vi.mocked(db).update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
          }),
        } as any);

        const result = await service.update(mockTaxConcept.id, { isEnabled: false });

        expect(result.isEnabled).toBe(false);
      });
    });

    describe('remove', () => {
      it('should delete tax concept successfully', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([mockTaxConcept])),
            }),
          }),
        } as any);

        vi.mocked(db).delete.mockReturnValue({
          where: vi.fn().mockReturnValue(makeAwaitable(undefined)),
        } as any);

        const result = await service.remove(mockTaxConcept.id);

        expect(db.delete).toHaveBeenCalledWith(taxConcepts);
        expect(result.message).toContain('deleted successfully');
      });

      it('should throw NotFoundException when deleting non-existent tax concept', async () => {
        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([])),
            }),
          }),
        } as any);

        await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
      });
    });

    describe('retention calculations', () => {
      it('should correctly parse retention percentage from string', async () => {
        const conceptWithDecimalPercentage = {
          ...mockTaxConcept,
          retentionPercentage: '3.50',
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([conceptWithDecimalPercentage])),
            }),
          }),
        } as any);

        const result = await service.findOne(mockTaxConcept.id);

        expect(result.retentionPercentage).toBe(3.5);
      });

      it('should correctly parse baseMin from string', async () => {
        const conceptWithBaseMin = {
          ...mockTaxConcept,
          baseMin: '1500.50',
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([conceptWithBaseMin])),
            }),
          }),
        } as any);

        const result = await service.findOne(mockTaxConcept.id);

        expect(result.baseMin).toBe(1500.5);
      });

      it('should correctly parse sustraendo from string', async () => {
        const conceptWithSustraendo = {
          ...mockTaxConcept,
          sustraendo: '250.7500',
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([conceptWithSustraendo])),
            }),
          }),
        } as any);

        const result = await service.findOne(mockTaxConcept.id);

        expect(result.sustraendo).toBe(250.75);
      });

      it('should handle zero values correctly', async () => {
        const conceptWithZeros = {
          ...mockTaxConcept,
          retentionPercentage: '0',
          baseMin: '0',
          sustraendo: '0',
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([conceptWithZeros])),
            }),
          }),
        } as any);

        const result = await service.findOne(mockTaxConcept.id);

        expect(result.retentionPercentage).toBe(0);
        expect(result.baseMin).toBe(0);
        expect(result.sustraendo).toBe(0);
      });

      it('should handle null values for baseMin and sustraendo', async () => {
        const conceptWithNulls = {
          ...mockTaxConcept,
          baseMin: null,
          sustraendo: null,
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeAwaitable([conceptWithNulls])),
            }),
          }),
        } as any);

        const result = await service.findOne(mockTaxConcept.id);

        expect(result.baseMin).toBe(0);
        expect(result.sustraendo).toBe(0);
      });
    });
  });

  describe('Edge Cases', () => {
    describe('Currency edge cases', () => {
      let service: CurrenciesService;

      beforeEach(() => {
        vi.clearAllMocks();
        service = new CurrenciesService({ store: vi.fn() } as never);
      });

      it('should handle base currency flag correctly', async () => {
        const baseCurrency = {
          id: '550e8400-e29b-41d4-a716-446655440100',
          code: 'VES',
          name: 'Venezuelan Bolivar',
          symbol: 'Bs',
          isBase: true,
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([baseCurrency])),
        } as any);

        const result = await service.findAll();

        expect(result[0].isBase).toBe(true);
      });

      it('should handle very small exchange rates', async () => {
        const smallRate = {
          id: '550e8400-e29b-41d4-a716-446655440101',
          currencyId: '550e8400-e29b-41d4-a716-446655440100',
          rate: '0.00000001',
          date: new Date(),
          source: 'API',
          currencyCode: 'BTC',
          currencyName: 'Bitcoin',
          currencySymbol: '₿',
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue(makeAwaitable([smallRate])),
            }),
          }),
        } as any);

        const result = await service.getLatestRates();

        expect(result[0].rate).toBeCloseTo(0.00000001);
      });

      it('should handle very large exchange rates', async () => {
        const largeRate = {
          id: '550e8400-e29b-41d4-a716-446655440102',
          currencyId: '550e8400-e29b-41d4-a716-446655440100',
          rate: '1234567890.1234567890',
          date: new Date(),
          source: 'API',
          currencyCode: 'ETH',
          currencyName: 'Ethereum',
          currencySymbol: 'Ξ',
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue(makeAwaitable([largeRate])),
            }),
          }),
        } as any);

        const result = await service.getLatestRates();

        expect(result[0].rate).toBeCloseTo(1234567890.123456789);
      });
    });

    describe('Bank edge cases', () => {
      let service: BanksService;

      beforeEach(() => {
        vi.clearAllMocks();
        service = new BanksService();
      });

      it('should handle bank codes with leading zeros', async () => {
        const bankWithLeadingZeros = {
          id: '550e8400-e29b-41d4-a716-446655440110',
          name: 'Banco del Tesoro',
          code: '0163',
          isActive: true,
          createdAt: new Date(),
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([bankWithLeadingZeros])),
        } as any);

        const result = await service.findAll();

        expect(result[0].code).toBe('0163');
      });

      it('should handle unicode characters in bank names', async () => {
        const unicodeBank = {
          id: '550e8400-e29b-41d4-a716-446655440111',
          name: 'Caixa Econômica Federal',
          code: '1040',
          isActive: true,
          createdAt: new Date(),
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([unicodeBank])),
        } as any);

        const result = await service.findAll();

        expect(result[0].name).toBe('Caixa Econômica Federal');
      });

      it('should handle null createdAt from database', async () => {
        const bankWithNullCreatedAt = {
          id: '550e8400-e29b-41d4-a716-446655440112',
          name: 'Test Bank',
          code: '9999',
          isActive: true,
          createdAt: null,
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([bankWithNullCreatedAt])),
        } as any);

        const result = await service.findAll();

        expect(result[0].createdAt).toBeNull();
      });
    });

    describe('Tax concept edge cases', () => {
      let service: TaxConceptsService;

      beforeEach(() => {
        vi.clearAllMocks();
        service = new TaxConceptsService();
      });

      it('should handle retention percentage at boundaries (0 and 100)', async () => {
        const zeroPercentConcept = {
          id: '550e8400-e29b-41d4-a716-446655440120',
          code: 'EXENTO',
          name: 'Exento',
          retentionPercentage: '0.00',
          baseMin: '0',
          sustraendo: '0',
          isEnabled: true,
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([zeroPercentConcept])),
        } as any);

        const result = await service.findAll();

        expect(result[0].retentionPercentage).toBe(0);
      });

      it('should handle 100% retention', async () => {
        const fullRetentionConcept = {
          id: '550e8400-e29b-41d4-a716-446655440121',
          code: 'RET-100',
          name: 'Full Retention',
          retentionPercentage: '100.00',
          baseMin: '0',
          sustraendo: '0',
          isEnabled: true,
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([fullRetentionConcept])),
        } as any);

        const result = await service.findAll();

        expect(result[0].retentionPercentage).toBe(100);
      });

      it('should handle high precision sustraendo values', async () => {
        const highPrecisionConcept = {
          id: '550e8400-e29b-41d4-a716-446655440122',
          code: 'HIGH-PREC',
          name: 'High Precision Concept',
          retentionPercentage: '5.00',
          baseMin: '1000.00',
          sustraendo: '123.456789',
          isEnabled: true,
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([highPrecisionConcept])),
        } as any);

        const result = await service.findAll();

        expect(result[0].sustraendo).toBeCloseTo(123.456789, 6);
      });

      it('should handle isEnabled as false from database', async () => {
        const disabledConcept = {
          id: '550e8400-e29b-41d4-a716-446655440123',
          code: 'DISABLED',
          name: 'Disabled Concept',
          retentionPercentage: '10.00',
          baseMin: '0',
          sustraendo: '0',
          isEnabled: false,
        };

        vi.mocked(db).select.mockReturnValue({
          from: vi.fn().mockReturnValue(makeAwaitable([disabledConcept])),
        } as any);

        const result = await service.findAll();

        expect(result[0].isEnabled).toBe(false);
      });
    });
  });
});
