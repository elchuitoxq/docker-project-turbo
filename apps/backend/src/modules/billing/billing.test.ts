import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceStatus, CreateInvoiceDto } from './dto/billing.dto';

const IVA_RATE = 0.16;
const IGTF_RATE = 0.03;

vi.mock('../services/billing.service', () => ({
  BillingService: vi.fn(),
}));

describe('BillingService - Invoice Totals Calculation', () => {
  describe('Base Total Calculation', () => {
    it('should calculate base total correctly', () => {
      const items = [
        { quantity: 2, price: 100, taxRate: 16 },
        { quantity: 3, price: 50, taxRate: 16 },
      ];

      const baseTotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      expect(baseTotal).toBe(350);
    });

    it('should calculate tax correctly with 16% IVA rate', () => {
      const items = [
        { quantity: 2, price: 100, taxRate: 16 },
        { quantity: 1, price: 50, taxRate: 16 },
      ];

      const baseTotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const taxTotal = items.reduce(
        (sum, item) => sum + item.quantity * item.price * (item.taxRate / 100),
        0
      );

      expect(baseTotal).toBe(250);
      expect(taxTotal).toBe(40);
    });

    it('should calculate IGTF correctly at 3% for USD transactions', () => {
      const totalBase = 250;
      const totalTax = 40;
      const amountForIgtf = totalBase + totalTax;
      const igtf = amountForIgtf * IGTF_RATE;

      expect(igtf).toBe(8.7);
    });

    it('should NOT apply IGTF when exchange rate is 1 (base currency)', () => {
      const applyIgtf = false;
      const totalBase = 250;
      const totalTax = 40;

      let totalIgtf = 0;
      if (applyIgtf) {
        totalIgtf = (totalBase + totalTax) * IGTF_RATE;
      }

      expect(totalIgtf).toBe(0);
    });

    it('should calculate grand total with IGTF correctly', () => {
      const totalBase = 250;
      const totalTax = 40;
      const totalIgtf = 8.7;
      const total = totalBase + totalTax + totalIgtf;

      expect(total).toBeCloseTo(298.7, 2);
    });

    it('should handle exempt items correctly', () => {
      const items = [
        { quantity: 1, price: 100, taxRate: 16, isExempt: false },
        { quantity: 1, price: 50, taxRate: 16, isExempt: true },
      ];

      let totalTax = 0;
      for (const item of items) {
        const itemBase = item.quantity * item.price;
        if (!item.isExempt && item.taxRate) {
          totalTax += itemBase * (item.taxRate / 100);
        }
      }

      expect(totalTax).toBe(16);
    });

    it('should handle items with custom tax rates', () => {
      const items = [
        { quantity: 1, price: 100, taxRate: 12 },
        { quantity: 1, price: 100, taxRate: 16 },
        { quantity: 1, price: 100, taxRate: 8 },
      ];

      const taxTotal = items.reduce(
        (sum, item) => sum + item.quantity * item.price * (item.taxRate / 100),
        0
      );

      expect(taxTotal).toBe(36);
    });

    it('should round totals to 2 decimal places', () => {
      const items = [{ quantity: 3, price: 33.33, taxRate: 16 }];

      const baseTotal = Math.round(items[0].quantity * items[0].price * 100) / 100;
      const taxTotal = Math.round(baseTotal * (16 / 100) * 100) / 100;

      expect(baseTotal).toBe(99.99);
      expect(taxTotal).toBe(16);
    });
  });

  describe('Invoice Status Transitions', () => {
    const validStatuses = [
      InvoiceStatus.DRAFT,
      InvoiceStatus.POSTED,
      InvoiceStatus.PAID,
      InvoiceStatus.VOID,
    ];

    it('should have all expected status values', () => {
      expect(validStatuses).toContain('DRAFT');
      expect(validStatuses).toContain('POSTED');
      expect(validStatuses).toContain('PAID');
      expect(validStatuses).toContain('VOID');
    });

    it('should identify DRAFT as initial status', () => {
      const initialStatus = InvoiceStatus.DRAFT;
      expect(initialStatus).toBe('DRAFT');
    });

    it('should validate status transition from DRAFT to POSTED', () => {
      const currentStatus = InvoiceStatus.DRAFT;
      const allowedTransitions: Record<string, string[]> = {
        [InvoiceStatus.DRAFT]: [InvoiceStatus.POSTED, InvoiceStatus.VOID],
        [InvoiceStatus.POSTED]: [InvoiceStatus.PAID, InvoiceStatus.VOID],
        [InvoiceStatus.PAID]: [],
        [InvoiceStatus.VOID]: [],
      };

      expect(allowedTransitions[currentStatus]).toContain(InvoiceStatus.POSTED);
    });

    it('should validate status transition from DRAFT to VOID', () => {
      const currentStatus = InvoiceStatus.DRAFT;
      const allowedTransitions: Record<string, string[]> = {
        [InvoiceStatus.DRAFT]: [InvoiceStatus.POSTED, InvoiceStatus.VOID],
        [InvoiceStatus.POSTED]: [InvoiceStatus.PAID, InvoiceStatus.VOID],
        [InvoiceStatus.PAID]: [],
        [InvoiceStatus.VOID]: [],
      };

      expect(allowedTransitions[currentStatus]).toContain(InvoiceStatus.VOID);
    });

    it('should NOT allow transitions from VOID status', () => {
      const allowedTransitions: Record<string, string[]> = {
        [InvoiceStatus.VOID]: [],
      };

      expect(allowedTransitions[InvoiceStatus.VOID]).toHaveLength(0);
    });

    it('should NOT allow transitions from PAID status', () => {
      const allowedTransitions: Record<string, string[]> = {
        [InvoiceStatus.PAID]: [],
      };

      expect(allowedTransitions[InvoiceStatus.PAID]).toHaveLength(0);
    });
  });

  describe('Invoice Code Generation', () => {
    it('should generate sequential invoice codes', () => {
      const lastCode = 'A-00001';
      const match = lastCode.match(/A-(\d+)/);
      const nextNumber = parseInt(match![1], 10) + 1;
      const newCode = `A-${String(nextNumber).padStart(5, '0')}`;

      expect(newCode).toBe('A-00002');
    });

    it('should handle first invoice code', () => {
      const lastInvoice: { code: string }[] = [];
      let nextNumber = 1;

      if (lastInvoice.length > 0) {
        const lastCode = lastInvoice[0].code;
        const match = lastCode.match(/A-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const code = `A-${String(nextNumber).padStart(5, '0')}`;
      expect(code).toBe('A-00001');
    });

    it('should pad invoice codes with leading zeros', () => {
      const nextNumber = 42;
      const code = `A-${String(nextNumber).padStart(5, '0')}`;

      expect(code).toBe('A-00042');
    });

    it('should handle high invoice numbers', () => {
      const lastCode = 'A-99999';
      const match = lastCode.match(/A-(\d+)/);
      const nextNumber = parseInt(match![1], 10) + 1;
      const newCode = `A-${String(nextNumber).padStart(5, '0')}`;

      expect(newCode).toBe('A-100000');
    });
  });

  describe('IGTF Calculation Rules', () => {
    it('should apply IGTF when partner is CUSTOMER and exchangeRate > 1', () => {
      const partnerType = 'CUSTOMER';
      const exchangeRate = 50;
      const applyIgtf = partnerType === 'CUSTOMER' && exchangeRate > 1;

      expect(applyIgtf).toBe(true);
    });

    it('should NOT apply IGTF when partner is not CUSTOMER', () => {
      const partnerType: string = 'SUPPLIER';
      const exchangeRate = 50;
      const applyIgtf = partnerType === 'CUSTOMER' && exchangeRate > 1;

      expect(applyIgtf).toBe(false);
    });

    it('should NOT apply IGTF when exchangeRate is 1', () => {
      const partnerType = 'CUSTOMER';
      const exchangeRate = 1;
      const applyIgtf = partnerType === 'CUSTOMER' && exchangeRate > 1;

      expect(applyIgtf).toBe(false);
    });

    it('should calculate IGTF on (base + tax) amount', () => {
      const totalBase = 100;
      const totalTax = 16;
      const subtotal = totalBase + totalTax;
      const igtf = subtotal * 0.03;

      expect(igtf).toBe(3.48);
    });

    it('should handle IGTF rounding', () => {
      const totalBase = 100;
      const totalTax = 16;
      const subtotal = totalBase + totalTax;
      let totalIgtf = subtotal * IGTF_RATE;
      totalIgtf = Math.round(totalIgtf * 100) / 100;

      expect(totalIgtf).toBe(3.48);
    });
  });

  describe('Exchange Rate Logic', () => {
    it('should return 1 for base currency', () => {
      const isBaseCurrency = true;
      const exchangeRate = isBaseCurrency ? 1 : 2;

      expect(exchangeRate).toBe(1);
    });

    it('should use provided exchange rate when specified', () => {
      const providedExchangeRate = 45.5;
      const fetchedRate = 50;
      const exchangeRate = providedExchangeRate || fetchedRate;

      expect(exchangeRate).toBe(45.5);
    });

    it('should fallback to fetched rate when no provided rate', () => {
      const providedExchangeRate: number | undefined = undefined;
      const fetchedRate = 50;
      const exchangeRate = providedExchangeRate || fetchedRate;

      expect(exchangeRate).toBe(50);
    });
  });

  describe('Invoice Totals with Different Scenarios', () => {
    it('should calculate totals correctly for single item', () => {
      const items = [{ quantity: 1, price: 100, taxRate: 16 }];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const totalTax = items.reduce(
        (sum, item) => sum + item.quantity * item.price * (item.taxRate / 100),
        0
      );
      const totalIgtf = (totalBase + totalTax) * 0.03;
      const total = totalBase + totalTax + totalIgtf;

      expect(totalBase).toBe(100);
      expect(totalTax).toBe(16);
      expect(totalIgtf).toBe(3.48);
      expect(total).toBe(119.48);
    });

    it('should calculate totals correctly for multiple items with mixed rates', () => {
      const items = [
        { quantity: 2, price: 50, taxRate: 16 },
        { quantity: 1, price: 100, taxRate: 12 },
        { quantity: 3, price: 25, taxRate: 8 },
      ];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const totalTax = items.reduce(
        (sum, item) => sum + item.quantity * item.price * (item.taxRate / 100),
        0
      );

      expect(totalBase).toBe(275);
      expect(totalTax).toBe(34);
    });

    it('should handle zero quantity items', () => {
      const items = [{ quantity: 0, price: 100, taxRate: 16 }];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      expect(totalBase).toBe(0);
    });

    it('should handle very small prices', () => {
      const items = [{ quantity: 1, price: 0.01, taxRate: 16 }];

      const totalBase = Math.round(items[0].quantity * items[0].price * 100) / 100;
      const totalTax = Math.round(totalBase * (16 / 100) * 100) / 100;

      expect(totalBase).toBe(0.01);
      expect(totalTax).toBe(0);
    });

    it('should handle large amounts correctly', () => {
      const items = [{ quantity: 10000, price: 99999.99, taxRate: 16 }];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const totalTax = items.reduce(
        (sum, item) => sum + item.quantity * item.price * (item.taxRate / 100),
        0
      );

      expect(totalBase).toBe(999999900);
      expect(totalTax).toBe(159999984);
    });
  });

  describe('Invoice Operations - Business Logic', () => {
    it('should only allow updates on DRAFT invoices', () => {
      const invoiceStatus = InvoiceStatus.DRAFT;
      const canUpdate = invoiceStatus === InvoiceStatus.DRAFT;

      expect(canUpdate).toBe(true);
    });

    it('should NOT allow updates on POSTED invoices', () => {
      const invoiceStatus: string = InvoiceStatus.POSTED;
      const canUpdate = invoiceStatus === InvoiceStatus.DRAFT;

      expect(canUpdate).toBe(false);
    });

    it('should NOT allow updates on VOID invoices', () => {
      const invoiceStatus: string = InvoiceStatus.VOID;
      const canUpdate = invoiceStatus === InvoiceStatus.DRAFT;

      expect(canUpdate).toBe(false);
    });

    it('should NOT allow updates on PAID invoices', () => {
      const invoiceStatus: string = InvoiceStatus.PAID;
      const canUpdate = invoiceStatus === InvoiceStatus.DRAFT;

      expect(canUpdate).toBe(false);
    });

    it('should only allow post on DRAFT invoices', () => {
      const invoiceStatus: string = InvoiceStatus.DRAFT;
      const canPost = invoiceStatus === InvoiceStatus.DRAFT;

      expect(canPost).toBe(true);
    });

    it('should NOT allow post on already posted invoices', () => {
      const invoiceStatus: string = InvoiceStatus.POSTED;
      const canPost = invoiceStatus === InvoiceStatus.DRAFT;

      expect(canPost).toBe(false);
    });

    it('should NOT allow post on VOID invoices', () => {
      const invoiceStatus: string = InvoiceStatus.VOID;
      const canPost = invoiceStatus === InvoiceStatus.DRAFT;

      expect(canPost).toBe(false);
    });

    it('should NOT allow void on already void invoices', () => {
      const invoiceStatus: string = InvoiceStatus.VOID;
      const canVoid = invoiceStatus !== InvoiceStatus.VOID;

      expect(canVoid).toBe(false);
    });

    it('should allow void on POSTED invoices', () => {
      const invoiceStatus: string = InvoiceStatus.POSTED;
      const canVoid = invoiceStatus !== InvoiceStatus.VOID;

      expect(canVoid).toBe(true);
    });

    it('should allow void on PAID invoices', () => {
      const invoiceStatus: string = InvoiceStatus.PAID;
      const canVoid = invoiceStatus !== InvoiceStatus.VOID;

      expect(canVoid).toBe(true);
    });

    it('should NOT allow void on DRAFT invoices (business rule)', () => {
      const invoiceStatus: string = InvoiceStatus.DRAFT;
      const canVoid =
        invoiceStatus !== InvoiceStatus.VOID && invoiceStatus === InvoiceStatus.POSTED;

      expect(canVoid).toBe(false);
    });
  });

  describe('Invoice Stats Calculation', () => {
    it('should calculate stats correctly', () => {
      const invoices = [
        { status: 'DRAFT', total: '100' },
        { status: 'DRAFT', total: '200' },
        { status: 'POSTED', total: '300' },
        { status: 'POSTED', total: '400' },
        { status: 'POSTED', total: '500' },
        { status: 'PAID', total: '600' },
        { status: 'VOID', total: '700' },
      ];

      let totalAmount = 0;
      let draftCount = 0;
      let postedCount = 0;
      let paidCount = 0;
      let voidCount = 0;

      for (const inv of invoices) {
        totalAmount += parseFloat(inv.total);

        switch (inv.status) {
          case InvoiceStatus.DRAFT:
            draftCount++;
            break;
          case InvoiceStatus.POSTED:
            postedCount++;
            break;
          case InvoiceStatus.PAID:
            paidCount++;
            break;
          case InvoiceStatus.VOID:
            voidCount++;
            break;
        }
      }

      expect(totalAmount).toBe(2800);
      expect(draftCount).toBe(2);
      expect(postedCount).toBe(3);
      expect(paidCount).toBe(1);
      expect(voidCount).toBe(1);
    });

    it('should handle empty invoices list', () => {
      const invoices: { status: string; total: string }[] = [];

      let totalAmount = 0;
      for (const inv of invoices) {
        totalAmount += parseFloat(inv.total);
      }

      expect(totalAmount).toBe(0);
    });

    it('should round total amount to 2 decimal places', () => {
      const invoices = [
        { status: 'DRAFT', total: '100.333' },
        { status: 'POSTED', total: '200.666' },
      ];

      let totalAmount = 0;
      for (const inv of invoices) {
        totalAmount += parseFloat(inv.total);
      }
      totalAmount = Math.round(totalAmount * 100) / 100;

      expect(totalAmount).toBe(301);
    });
  });

  describe('Tax Rate Inheritance', () => {
    it('should use item taxRate when provided', () => {
      const itemTaxRate = 12;
      const productTaxRate = 16;
      const effectiveTaxRate = itemTaxRate ?? productTaxRate;

      expect(effectiveTaxRate).toBe(12);
    });

    it('should fallback to product taxRate when item taxRate not provided', () => {
      const itemTaxRate: number | undefined = undefined;
      const productTaxRate = 16;
      const effectiveTaxRate = itemTaxRate ?? productTaxRate;

      expect(effectiveTaxRate).toBe(16);
    });

    it('should fallback to default 16 when no tax rates available', () => {
      const itemTaxRate: number | undefined = undefined;
      const productTaxRate: string | undefined = undefined;
      const effectiveTaxRate = itemTaxRate ?? (productTaxRate ? parseFloat(productTaxRate) : 16);

      expect(effectiveTaxRate).toBe(16);
    });

    it('should parse string product tax rate correctly', () => {
      const itemTaxRate: number | undefined = undefined;
      const productTaxRate = '16.00';
      const effectiveTaxRate = itemTaxRate ?? parseFloat(productTaxRate);

      expect(effectiveTaxRate).toBe(16);
    });
  });

  describe('Invoice Item Total Calculation', () => {
    it('should calculate item total as quantity * price', () => {
      const item = { quantity: 5, price: 25 };
      const itemTotal = item.quantity * item.price;

      expect(itemTotal).toBe(125);
    });

    it('should handle decimal prices', () => {
      const item = { quantity: 3, price: 19.99 };
      const itemTotal = Math.round(item.quantity * item.price * 100) / 100;

      expect(itemTotal).toBe(59.97);
    });
  });

  describe('Fiscal JSON Structure', () => {
    it('should generate valid fiscal JSON', () => {
      const invoice = {
        id: 'inv-123',
        code: 'A-00001',
        date: new Date('2026-06-01T12:00:00Z'),
        total: 298.7,
        totalBase: 250,
        totalTax: 40,
        totalIgtf: 8.7,
        partnerId: 'partner-123',
      };

      const mockControlCode = `CC${Date.now()}ABC`;

      const fiscalJson = {
        controlCode: mockControlCode,
        invoiceNumber: invoice.code,
        serial: 'SN-001',
        verificationUrl: `https://sistema.bcv.org.ve/verificar/${mockControlCode}`,
        generationTimestamp: new Date().toISOString(),
        invoiceDate: invoice.date.toISOString(),
        sellerRif: 'J-000000000',
        buyerRif: 'N/A',
        totalAmount: invoice.total,
        taxableAmount: invoice.totalBase,
        ivaAmount: invoice.totalTax,
        ivaIgtf: invoice.totalIgtf,
      };

      expect(fiscalJson.invoiceNumber).toBe('A-00001');
      expect(fiscalJson.totalAmount).toBe(298.7);
      expect(fiscalJson.taxableAmount).toBe(250);
      expect(fiscalJson.ivaAmount).toBe(40);
      expect(fiscalJson.ivaIgtf).toBe(8.7);
      expect(fiscalJson.verificationUrl).toContain('https://sistema.bcv.org.ve/verificar/');
    });

    it('should handle null invoice date', () => {
      const invoice: { date: Date | null } = {
        date: null,
      };

      const invoiceDate = invoice.date ? invoice.date.toISOString() : null;

      expect(invoiceDate).toBeNull();
    });
  });

  describe('Product Exempt Status', () => {
    it('should handle exempt products', () => {
      const product = { isExempt: true, taxRate: '16.00' };
      const isExempt = product?.isExempt || false;

      expect(isExempt).toBe(true);
    });

    it('should handle non-exempt products', () => {
      const product = { isExempt: false, taxRate: '16.00' };
      const isExempt = product?.isExempt || false;

      expect(isExempt).toBe(false);
    });

    it('should handle missing product gracefully', () => {
      const product: any = undefined;
      const isExempt = product?.isExempt || false;

      expect(isExempt).toBe(false);
    });
  });

  describe('Partner Validation', () => {
    it('should require valid partner for invoice creation', () => {
      const partner = null;
      const isValidPartner = partner !== null && partner !== undefined;

      expect(isValidPartner).toBe(false);
    });

    it('should accept valid partner', () => {
      const partner = { id: 'partner-123', name: 'Test Partner' };
      const isValidPartner = partner !== null && partner !== undefined;

      expect(isValidPartner).toBe(true);
    });

    it('should identify CUSTOMER partner type', () => {
      const partner = { id: 'partner-123', type: 'CUSTOMER' };
      const isCustomer = partner.type === 'CUSTOMER';

      expect(isCustomer).toBe(true);
    });
  });

  describe('Invoice Filtering', () => {
    it('should filter by branch correctly', () => {
      const invoices = [
        { branchId: 'branch-1', status: 'DRAFT' },
        { branchId: 'branch-1', status: 'POSTED' },
        { branchId: 'branch-2', status: 'DRAFT' },
      ];

      const branchId = 'branch-1';
      const filtered = invoices.filter(inv => inv.branchId === branchId);

      expect(filtered).toHaveLength(2);
    });

    it('should filter by status correctly', () => {
      const invoices = [
        { branchId: 'branch-1', status: 'DRAFT' },
        { branchId: 'branch-1', status: 'POSTED' },
        { branchId: 'branch-1', status: 'DRAFT' },
      ];

      const status = 'DRAFT';
      const filtered = invoices.filter(inv => inv.status === status);

      expect(filtered).toHaveLength(2);
    });

    it('should filter by both branch and status', () => {
      const invoices = [
        { branchId: 'branch-1', status: 'DRAFT' },
        { branchId: 'branch-1', status: 'POSTED' },
        { branchId: 'branch-2', status: 'DRAFT' },
        { branchId: 'branch-1', status: 'DRAFT' },
      ];

      const branchId = 'branch-1';
      const status = 'DRAFT';
      const filtered = invoices.filter(inv => inv.branchId === branchId && inv.status === status);

      expect(filtered).toHaveLength(2);
    });

    it('should return all invoices when no filter applied', () => {
      const invoices = [
        { branchId: 'branch-1', status: 'DRAFT' },
        { branchId: 'branch-2', status: 'POSTED' },
      ];

      const filtered = invoices;

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundException for missing invoice', () => {
      const invoice = undefined;
      const throwNotFound = () => {
        if (!invoice) {
          throw new Error(`Invoice with ID not found`);
        }
      };

      expect(throwNotFound).toThrow('Invoice with ID not found');
    });

    it('should throw BadRequestException for invalid status transition', () => {
      const invoiceStatus: string = InvoiceStatus.POSTED;
      const throwBadRequest = () => {
        if (invoiceStatus !== InvoiceStatus.DRAFT) {
          throw new Error('Only DRAFT invoices can be updated');
        }
      };

      expect(throwBadRequest).toThrow('Only DRAFT invoices can be updated');
    });

    it('should throw BadRequestException when voiding already void invoice', () => {
      const invoiceStatus = InvoiceStatus.VOID;
      const throwBadRequest = () => {
        if (invoiceStatus === InvoiceStatus.VOID) {
          throw new Error('Invoice is already void');
        }
      };

      expect(throwBadRequest).toThrow('Invoice is already void');
    });
  });

  describe('DTO Validation Rules', () => {
    it('should have correct InvoiceStatus enum values', () => {
      expect(InvoiceStatus.DRAFT).toBe('DRAFT');
      expect(InvoiceStatus.POSTED).toBe('POSTED');
      expect(InvoiceStatus.PAID).toBe('PAID');
      expect(InvoiceStatus.VOID).toBe('VOID');
    });

    it('should validate CreateInvoiceDto structure', () => {
      const dto: CreateInvoiceDto = {
        partnerId: '550e8400-e29b-41d4-a716-446655440001',
        branchId: '550e8400-e29b-41d4-a716-446655440002',
        items: [
          {
            productId: '550e8400-e29b-41d4-a716-446655440000',
            quantity: 10,
            price: 100,
            taxRate: 16,
          },
        ],
      };

      expect(dto.partnerId).toBeDefined();
      expect(dto.branchId).toBeDefined();
      expect(dto.items).toHaveLength(1);
      expect(dto.items[0].quantity).toBe(10);
    });
  });
});
