import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TreasuryService } from './services/treasury.service';
import {
  CreatePaymentDto,
  PaymentStatus,
  PaymentType,
  CreatePaymentMethodDto,
  CreateBankAccountDto,
} from './dto/treasury.dto';

const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();

  function createIterableResult(returnValue: any) {
    return {
      then: (resolve: any) => resolve(returnValue),
      map: (fn: (item: any) => any) => createIterableResult(returnValue.map(fn)),
      [Symbol.iterator]: function* () {
        for (const v of returnValue) yield v;
      },
    };
  }

  function setupChain(returnValue: any) {
    const iterableResult = createIterableResult(returnValue);
    const mockLimit = vi.fn().mockResolvedValue(returnValue);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit, ...iterableResult });
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit, ...iterableResult });
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      ...iterableResult,
    });

    mockSelect.mockReturnValue({ from: mockFrom });

    return { mockFrom, mockWhere, mockOrderBy, mockLimit };
  }

  return { mockSelect, mockInsert, mockUpdate, mockDelete, setupChain };
});

vi.mock('../../database', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    delete: mocks.mockDelete,
  },
}));

vi.mock('../../schema', () => ({
  payments: {},
  paymentAllocations: {},
  creditNotes: {},
  creditNoteUsages: {},
  taxRetentions: {},
  taxRetentionLines: {},
  documentLinks: {},
  invoices: {},
  bankAccounts: {},
  paymentMethods: {},
  partners: {},
  creditNoteItems: {},
  currencies: {},
  dailyCloses: {},
}));

describe('TreasuryService', () => {
  let service: TreasuryService;

  const mockPaymentMethod = {
    id: 'method-1',
    name: 'Cash USD',
    code: 'CASH_USD',
    isDigital: false,
    currencyId: 'currency-1',
    branchId: 'branch-1',
  };

  const mockBankAccount = {
    id: 'bank-1',
    name: 'Banesco Checking',
    accountNumber: '****1234',
    type: 'CHECKING',
    currencyId: 'currency-1',
    branchId: 'branch-1',
    currentBalance: '1000.00',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayment = {
    id: 'payment-1',
    code: 'PAY-00001',
    invoiceId: 'invoice-1',
    partnerId: 'partner-1',
    branchId: 'branch-1',
    methodId: 'method-1',
    status: 'POSTED',
    type: 'INCOME',
    amount: '500.00',
    currencyId: 'currency-1',
    exchangeRate: '1.00',
    bankAccountId: 'bank-1',
    reference: 'REF-001',
    date: new Date(),
    userId: 'user-1',
    createdAt: new Date(),
  };

  const mockPartner = {
    id: 'partner-1',
    name: 'Test Partner',
    email: 'partner@test.com',
    taxId: 'J-123456789',
    address: 'Test Address',
    phone: '1234567890',
    type: 'CUSTOMER',
    taxpayerType: 'ORDINARY',
    retentionRate: '0',
    isSpecialTaxpayer: false,
    creditLimit: '10000.00',
    islrConceptId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    service = new TreasuryService(undefined as never);
    mocks.mockSelect.mockClear();
    mocks.mockInsert.mockClear();
    mocks.mockUpdate.mockClear();
    mocks.mockDelete.mockClear();
  });

  describe('findAll', () => {
    it('should return all payments when no filters provided', async () => {
      mocks.setupChain([mockPayment]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(500);
    });

    it('should handle empty payments list', async () => {
      mocks.setupChain([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a payment by id', async () => {
      mocks.setupChain([mockPayment]);

      const result = await service.findOne('payment-1');

      expect(result.id).toBe('payment-1');
      expect(result.amount).toBe(500);
    });

    it('should throw NotFoundException when payment not found', async () => {
      mocks.setupChain([]);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Payment with ID nonexistent not found'
      );
    });
  });

  describe('create', () => {
    const createPaymentDto: CreatePaymentDto = {
      partnerId: 'partner-1',
      branchId: 'branch-1',
      methodId: 'method-1',
      amount: 500,
      currencyId: 'currency-1',
      exchangeRate: 1.0,
      bankAccountId: 'bank-1',
      invoiceId: 'invoice-1',
      reference: 'REF-001',
      type: PaymentType.INCOME,
    };

    it('should throw NotFoundException when payment method not found', async () => {
      mocks.setupChain([]);

      await expect(service.create(createPaymentDto, 'user-1')).rejects.toThrow(
        'Payment method with ID method-1 not found'
      );
    });

    it('rechaza el pago si el día está cerrado (T-05-03)', async () => {
      const closedDay = {
        assertOpen: vi.fn().mockRejectedValue(new Error('El cierre del 2026-06-01 está cerrado')),
      };
      const serviceWithClose = new TreasuryService(undefined as never, closedDay as never);

      await expect(serviceWithClose.create(createPaymentDto, 'user-1')).rejects.toThrow(
        /está cerrado/
      );
    });
  });

  describe('voidPayment', () => {
    it('should throw NotFoundException when payment not found', async () => {
      mocks.setupChain([]);

      await expect(service.voidPayment('nonexistent')).rejects.toThrow(
        'Payment with ID nonexistent not found'
      );
    });

    it('should throw BadRequestException when payment already void', async () => {
      const voidPayment = { ...mockPayment, status: 'VOID' };
      mocks.setupChain([voidPayment]);

      await expect(service.voidPayment('payment-1')).rejects.toThrow('Payment is already void');
    });
  });

  describe('getMethods', () => {
    it('should return all payment methods', async () => {
      mocks.setupChain([mockPaymentMethod]);

      const result = await service.getMethods();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('CASH_USD');
    });
  });

  describe('createMethod', () => {
    it('should create a new payment method', async () => {
      const createDto: CreatePaymentMethodDto = {
        name: 'Cash VES',
        code: 'CASH_VES',
        isDigital: false,
        currencyId: 'currency-1',
        branchId: 'branch-1',
      };

      const mockNewMethod = { ...createDto, id: 'new-method-id' };

      mocks.mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNewMethod]),
        }),
      });

      const result = await service.createMethod(createDto);

      expect(result.id).toBe('new-method-id');
      expect(result.name).toBe('Cash VES');
    });
  });

  describe('getBankAccounts', () => {
    it('should return all bank accounts with parsed balances', async () => {
      mocks.setupChain([mockBankAccount]);

      const result = await service.getBankAccounts();

      expect(result).toHaveLength(1);
      expect(result[0].currentBalance).toBe(1000);
    });
  });

  describe('createBankAccount', () => {
    it('should create a new bank account with initial balance', async () => {
      const createDto: CreateBankAccountDto = {
        name: 'New Bank Account',
        accountNumber: '****5678',
        type: 'CHECKING',
        currencyId: 'currency-1',
        branchId: 'branch-1',
        currentBalance: 5000,
      };

      const mockNewAccount = { ...createDto, id: 'new-bank-id' };

      mocks.mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNewAccount]),
        }),
      });

      const result = await service.createBankAccount(createDto);

      expect(result.id).toBe('new-bank-id');
      expect(result.currentBalance).toBe(5000);
    });

    it('should create bank account with zero balance when not specified', async () => {
      const createDto: CreateBankAccountDto = {
        name: 'New Bank Account',
        accountNumber: '****5678',
        type: 'CHECKING',
        currencyId: 'currency-1',
      };

      const mockNewAccount = { ...createDto, id: 'new-bank-id', currentBalance: '0' };

      mocks.mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNewAccount]),
        }),
      });

      const result = await service.createBankAccount(createDto);

      expect(result.currentBalance).toBe(0);
    });
  });

  describe('getPartnerStatement', () => {
    it('should throw NotFoundException when partner not found', async () => {
      mocks.setupChain([]);

      await expect(service.getPartnerStatement('nonexistent')).rejects.toThrow(
        'Partner with ID nonexistent not found'
      );
    });
  });
});
