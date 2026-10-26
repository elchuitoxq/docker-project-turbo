import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportsService, FiscalSummary } from './reports.service';

vi.mock('../../database', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue({}),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue({}),
        }),
      }),
    }),
  },
}));

import { db } from '../../database';

const mockDb = db as any;

const createChain = (resolvedData: any[]) => {
  const queryResult = {
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: Function) => resolve(resolvedData),
  };

  const fromResult = {
    where: vi.fn().mockReturnValue(queryResult),
    orderBy: vi.fn().mockReturnValue(queryResult),
    limit: vi.fn().mockReturnValue(queryResult),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    then: (resolve: Function) => resolve(resolvedData),
  };

  return {
    from: vi.fn().mockReturnValue(fromResult),
  };
};

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPartner = {
    id: 'partner-1',
    name: 'Test Company C.A.',
    email: 'test@company.com',
    taxId: 'J-12345678-9',
    address: 'Test Address',
    phone: '0123456789',
    type: 'CUSTOMER' as const,
    taxpayerType: 'ORDINARY' as const,
    retentionRate: '0' as const,
    isSpecialTaxpayer: false,
    creditLimit: '0' as const,
    islrConceptId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBranch = {
    id: 'branch-1',
    name: 'Main Branch',
    address: 'Main Address',
    taxId: 'J-00000000-0',
    phone: '0000000000',
    email: 'branch@company.com',
    isActive: true,
    createdAt: new Date(),
  };

  const mockInvoice = {
    id: 'invoice-1',
    code: 'INV-001',
    partnerId: 'partner-1',
    branchId: 'branch-1',
    currencyId: 'currency-1',
    exchangeRate: '1' as const,
    type: 'SALE' as const,
    invoiceNumber: '0001-001',
    status: 'POSTED' as const,
    fiscalStatus: 'APPROVED' as const,
    totalBase: '1000.00',
    totalTax: '160.00',
    totalIgtf: '30.00',
    total: '1190.00',
    date: new Date('2024-01-15T00:00:00Z'),
    dueDate: null,
    warehouseId: null,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPurchaseInvoice = {
    id: 'invoice-2',
    code: 'INV-002',
    partnerId: 'partner-1',
    branchId: 'branch-1',
    currencyId: 'currency-1',
    exchangeRate: '1' as const,
    type: 'PURCHASE' as const,
    invoiceNumber: '0002-001',
    status: 'POSTED' as const,
    fiscalStatus: 'APPROVED' as const,
    totalBase: '500.00',
    totalTax: '80.00',
    totalIgtf: '15.00',
    total: '595.00',
    date: new Date('2024-01-20T00:00:00Z'),
    dueDate: null,
    warehouseId: null,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreditNote = {
    id: 'cn-1',
    code: 'CN-001',
    invoiceId: 'invoice-1',
    partnerId: 'partner-1',
    branchId: 'branch-1',
    warehouseId: null,
    currencyId: 'currency-1',
    exchangeRate: '1' as const,
    status: 'POSTED' as const,
    totalBase: '100.00',
    totalTax: '16.00',
    totalIgtf: '3.00',
    total: '119.00',
    date: new Date('2024-01-25T00:00:00Z'),
    userId: 'user-1',
    parentPaymentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRetentionIva = {
    id: 'ret-iva-1',
    code: 'R-IVA-001',
    partnerId: 'partner-1',
    branchId: 'branch-1',
    period: '2024-01',
    type: 'IVA' as const,
    totalBase: '1000.00',
    totalTax: '160.00',
    totalRetained: '160.00',
    xmlContent: null,
    date: new Date('2024-01-31T12:00:00Z'),
    userId: 'user-1',
    createdAt: new Date(),
  };

  const mockRetentionIslr = {
    id: 'ret-islr-1',
    code: 'R-ISLR-001',
    partnerId: 'partner-1',
    branchId: 'branch-1',
    period: '2024-01',
    type: 'ISLR' as const,
    totalBase: '1000.00',
    totalTax: '100.00',
    totalRetained: '100.00',
    xmlContent: null,
    date: new Date('2024-01-31T12:00:00Z'),
    userId: 'user-1',
    createdAt: new Date(),
  };

  const mockRetentionLineIva = {
    id: 'ret-line-1',
    retentionId: 'ret-iva-1',
    invoiceId: 'invoice-1',
    paymentId: null,
    baseAmount: '1000.00',
    taxAmount: '160.00',
    retainedAmount: '160.00',
    conceptId: null,
  };

  const mockRetentionLineIslr = {
    id: 'ret-line-2',
    retentionId: 'ret-islr-1',
    invoiceId: 'invoice-1',
    paymentId: null,
    baseAmount: '1000.00',
    taxAmount: '100.00',
    retainedAmount: '100.00',
    conceptId: null,
  };

  beforeEach(() => {
    service = new ReportsService();
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.select.mockImplementation(() => createChain([]));
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date(2024, 0, 15);
      const result = (service as any)['formatDate'](date);
      expect(result).toBe('2024-01-15');
    });

    it('should pad single digit month and day', () => {
      const date = new Date(2024, 2, 5);
      const result = (service as any)['formatDate'](date);
      expect(result).toBe('2024-03-05');
    });
  });

  describe('formatDateForSeniat', () => {
    it('should format date in SENIAT format DD/MM/YYYY', () => {
      const date = new Date(2024, 0, 15);
      const result = (service as any)['formatDateForSeniat'](date);
      expect(result).toBe('15/01/2024');
    });

    it('should pad single digit month and day', () => {
      const date = new Date(2024, 2, 5);
      const result = (service as any)['formatDateForSeniat'](date);
      expect(result).toBe('05/03/2024');
    });
  });

  describe('parseNumeric', () => {
    it('should return 0 for null', () => {
      expect((service as any)['parseNumeric'](null)).toBe(0);
    });

    it('should return 0 for undefined', () => {
      expect((service as any)['parseNumeric'](undefined)).toBe(0);
    });

    it('should return number as-is', () => {
      expect((service as any)['parseNumeric'](100.5)).toBe(100.5);
    });

    it('should parse string to number', () => {
      expect((service as any)['parseNumeric']('100.50')).toBe(100.5);
    });

    it('should return 0 for invalid string', () => {
      expect((service as any)['parseNumeric']('invalid')).toBe(0);
    });
  });

  describe('buildDateConditions', () => {
    it('should return no conditions when no dates provided', () => {
      const result = (service as any)['buildDateConditions']();
      expect(result).toBeUndefined();
    });

    it('should return gte condition when only dateFrom provided', () => {
      const result = (service as any)['buildDateConditions']('2024-01-01');
      expect(result).toBeDefined();
    });

    it('should return and conditions when both dates provided', () => {
      const result = (service as any)['buildDateConditions']('2024-01-01', '2024-01-31');
      expect(result).toBeDefined();
    });
  });

  describe('getFiscalSummary', () => {
    it('should return empty summary when no data', async () => {
      mockDb.select.mockImplementation(() => createChain([]));

      const result = await service.getFiscalSummary();

      expect(result.totalInvoices).toBe(0);
      expect(result.totalCreditNotes).toBe(0);
      expect(result.totalRetencionesIva).toBe(0);
      expect(result.totalRetencionesIslr).toBe(0);
      expect(result.totalBaseImponible).toBe(0);
      expect(result.totalIva).toBe(0);
      expect(result.totalIgtf).toBe(0);
      expect(result.totalCreditNotesAmount).toBe(0);
    });

    it('should calculate fiscal summary with invoices', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([mockInvoice]);
        }
        return createChain([]);
      });

      const result = await service.getFiscalSummary();

      expect(result.totalInvoices).toBe(1);
      expect(result.totalBaseImponible).toBe(1000);
      expect(result.totalIva).toBe(160);
      expect(result.totalIgtf).toBe(30);
    });

    it('should calculate fiscal summary with credit notes', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([]);
        }
        if (callCount === 2) {
          return createChain([]);
        }
        if (callCount === 3) {
          return createChain([]);
        }
        if (callCount === 4) {
          return createChain([mockCreditNote]);
        }
        return createChain([]);
      });

      const result = await service.getFiscalSummary();

      expect(result.totalCreditNotes).toBe(1);
      expect(result.totalCreditNotesAmount).toBe(119);
    });

    it('should calculate fiscal summary with IVA retentions', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([]);
        }
        if (callCount === 2) {
          return createChain([mockRetentionIva]);
        }
        if (callCount === 3) {
          return createChain([]);
        }
        if (callCount === 4) {
          return createChain([]);
        }
        return createChain([]);
      });

      const result = await service.getFiscalSummary();

      expect(result.totalRetencionesIva).toBe(160);
    });

    it('should calculate fiscal summary with ISLR retentions', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([]);
        }
        if (callCount === 2) {
          return createChain([]);
        }
        if (callCount === 3) {
          return createChain([mockRetentionIslr]);
        }
        if (callCount === 4) {
          return createChain([]);
        }
        return createChain([]);
      });

      const result = await service.getFiscalSummary();

      expect(result.totalRetencionesIslr).toBe(100);
    });

    it('should filter by date range', async () => {
      mockDb.select.mockImplementation(() => createChain([mockInvoice]));

      const result = await service.getFiscalSummary('2024-01-01', '2024-01-31');

      expect(result.dateFrom).toBe('2024-01-01');
      expect(result.dateTo).toBe('2024-01-31');
    });

    it('should return N/A for date range when not provided', async () => {
      mockDb.select.mockImplementation(() => createChain([]));

      const result = await service.getFiscalSummary();

      expect(result.dateFrom).toBe('N/A');
      expect(result.dateTo).toBe('N/A');
    });

    it('should sum multiple invoices correctly', async () => {
      const invoicesWithValues = [
        {
          ...mockInvoice,
          id: 'inv-1',
          totalBase: '1000.00',
          totalTax: '160.00',
          totalIgtf: '30.00',
        },
        {
          ...mockInvoice,
          id: 'inv-2',
          totalBase: '2000.00',
          totalTax: '320.00',
          totalIgtf: '60.00',
        },
      ];

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain(invoicesWithValues);
        }
        return createChain([]);
      });

      const result = await service.getFiscalSummary();

      expect(result.totalInvoices).toBe(2);
      expect(result.totalBaseImponible).toBe(3000);
      expect(result.totalIva).toBe(480);
      expect(result.totalIgtf).toBe(90);
    });

    it('should round totals to 2 decimal places', async () => {
      const invoicesWithDecimals = [
        {
          ...mockInvoice,
          id: 'inv-1',
          totalBase: '1000.555',
          totalTax: '160.088',
          totalIgtf: '30.011',
        },
      ];

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain(invoicesWithDecimals);
        }
        return createChain([]);
      });

      const result = await service.getFiscalSummary();

      expect(result.totalBaseImponible).toBe(1000.56);
      expect(result.totalIva).toBe(160.09);
      expect(result.totalIgtf).toBe(30.01);
    });
  });

  describe('getRetencionesIvaTxt', () => {
    it('should return empty string when no retentions', async () => {
      mockDb.select.mockImplementation(() => createChain([]));

      const result = await service.getRetencionesIvaTxt();

      expect(result).toBe('');
    });

    it('should generate TXT format correctly', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([mockRetentionIva]);
        }
        if (callCount === 2) {
          return createChain([mockPartner]);
        }
        if (callCount === 3) {
          return createChain([mockRetentionLineIva]);
        }
        return createChain([]);
      });

      const result = await service.getRetencionesIvaTxt();

      expect(result).toContain('J-12345678-9');
      expect(result).toContain('31/01/2024');
      expect(result).toContain('R-IVA-001');
      expect(result).toContain('1000.00');
      expect(result).toContain('160.00');
      expect(result).toContain('2024-01');
    });

    it('should filter by date range', async () => {
      mockDb.select.mockImplementation(() => createChain([mockRetentionIva]));

      await service.getRetencionesIvaTxt('2024-01-01', '2024-01-31');

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should handle missing partner taxId', async () => {
      const retentionWithoutPartner = { ...mockRetentionIva, partnerId: 'unknown' };
      const partnerWithoutTaxId = { ...mockPartner, taxId: '' };

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([retentionWithoutPartner]);
        }
        if (callCount === 2) {
          return createChain([partnerWithoutTaxId]);
        }
        if (callCount === 3) {
          return createChain([mockRetentionLineIva]);
        }
        return createChain([]);
      });

      const result = await service.getRetencionesIvaTxt();

      expect(result).toContain('|');
    });
  });

  describe('getRetencionesIslrXml', () => {
    it('should generate valid XML structure', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([mockRetentionIslr]);
        }
        if (callCount === 2) {
          return createChain([mockBranch]);
        }
        if (callCount === 3) {
          return createChain([mockPartner]);
        }
        if (callCount === 4) {
          return createChain([mockRetentionLineIslr]);
        }
        if (callCount === 5) {
          return createChain([mockInvoice]);
        }
        return createChain([]);
      });

      const result = await service.getRetencionesIslrXml();

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<RelacionRetencionesISLR>');
      expect(result).toContain('<Cabecera>');
      expect(result).toContain('<Detalle>');
      expect(result).toContain('</RelacionRetencionesISLR>');
    });

    it('should include company info from branch', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([]);
        }
        if (callCount === 2) {
          return createChain([mockBranch]);
        }
        return createChain([]);
      });

      const result = await service.getRetencionesIslrXml();

      expect(result).toContain('<RifAgente>J-00000000-0</RifAgente>');
      expect(result).toContain('<NombreRazonSocial>Main Branch</NombreRazonSocial>');
    });

    it('should use default company info when no branch', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([]);
        }
        if (callCount === 2) {
          return createChain([]);
        }
        return createChain([]);
      });

      const result = await service.getRetencionesIslrXml();

      expect(result).toContain('<RifAgente>J-000000000</RifAgente>');
      expect(result).toContain('<NombreRazonSocial>Empresa</NombreRazonSocial>');
    });

    it('should include period in header', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([]);
        }
        if (callCount === 2) {
          return createChain([mockBranch]);
        }
        return createChain([]);
      });

      const result = await service.getRetencionesIslrXml('2024-01-01', '2024-01-31');

      expect(result).toContain('<Periodo>2024-01-01 - 2024-01-31</Periodo>');
    });

    it('should handle retention without invoice', async () => {
      const retentionLineWithoutInvoice = { ...mockRetentionLineIslr, invoiceId: null };

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([mockRetentionIslr]);
        }
        if (callCount === 2) {
          return createChain([mockBranch]);
        }
        if (callCount === 3) {
          return createChain([mockPartner]);
        }
        if (callCount === 4) {
          return createChain([retentionLineWithoutInvoice]);
        }
        if (callCount === 5) {
          return createChain([]);
        }
        return createChain([]);
      });

      const result = await service.getRetencionesIslrXml();

      expect(result).toContain('<Retencion>');
      expect(result).toContain('<NumeroFactura>R-ISLR-001</NumeroFactura>');
    });
  });

  describe('getLibroVentas', () => {
    it('should return headers only when no invoices', async () => {
      mockDb.select.mockImplementation(() => createChain([]));

      const result = await service.getLibroVentas();

      expect(result).toContain('Fecha|N° Factura|N° Control|RifCliente');
    });

    it('should generate libro ventas with correct structure', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([mockInvoice]);
        }
        if (callCount === 2) {
          return createChain([mockPartner]);
        }
        if (callCount === 3) {
          return createChain([]);
        }
        return createChain([]);
      });

      const result = await service.getLibroVentas();

      const lines = result.split('\n');
      expect(lines.length).toBe(2);
      expect(lines[1]).toContain('INV-001');
      expect(lines[1]).toContain('J-12345678-9');
      expect(lines[1]).toContain('Test Company C.A.');
    });

    it('should filter only POSTED invoices', async () => {
      const draftInvoice = { ...mockInvoice, status: 'DRAFT' };

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([draftInvoice]);
        }
        return createChain([]);
      });

      const result = await service.getLibroVentas();

      expect(result.split('\n').length).toBe(2);
    });

    it('should calculate IVA correctly for 16% rate', async () => {
      const invoiceWithItems = {
        ...mockInvoice,
        total: '1160.00',
        totalBase: '1000.00',
        totalTax: '160.00',
      };

      const itemGeneral = {
        id: 'item-1',
        invoiceId: 'invoice-1',
        productId: 'prod-1',
        quantity: '1' as const,
        price: '1000.00' as const,
        cost: null,
        taxRate: '16.00' as const,
        total: '1000.00' as const,
      };

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([invoiceWithItems]);
        }
        if (callCount === 2) {
          return createChain([mockPartner]);
        }
        if (callCount === 3) {
          return createChain([itemGeneral]);
        }
        return createChain([]);
      });

      const result = await service.getLibroVentas();

      expect(result).toContain('1000.00');
      expect(result).toContain('160.00');
    });

    it('should calculate IVA correctly for 8% reduced rate', async () => {
      const invoiceWithReduced = {
        ...mockInvoice,
        id: 'inv-reduced',
        total: '1080.00',
        totalBase: '1000.00',
        totalTax: '80.00',
      };

      const itemReducido = {
        id: 'item-2',
        invoiceId: 'inv-reduced',
        productId: 'prod-1',
        quantity: '1' as const,
        price: '1000.00' as const,
        cost: null,
        taxRate: '8.00' as const,
        total: '1000.00' as const,
      };

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([invoiceWithReduced]);
        }
        if (callCount === 2) {
          return createChain([mockPartner]);
        }
        if (callCount === 3) {
          return createChain([itemReducido]);
        }
        return createChain([]);
      });

      const result = await service.getLibroVentas();

      expect(result).toContain('80.00');
    });

    it('should categorize exento items correctly', async () => {
      const invoiceExento = {
        ...mockInvoice,
        id: 'inv-exento',
        total: '1000.00',
        totalBase: '1000.00',
        totalTax: '0.00',
      };

      const itemExento = {
        id: 'item-3',
        invoiceId: 'inv-exento',
        productId: 'prod-1',
        quantity: '1' as const,
        price: '1000.00' as const,
        cost: null,
        taxRate: '0.00' as const,
        total: '1000.00' as const,
      };

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([invoiceExento]);
        }
        if (callCount === 2) {
          return createChain([mockPartner]);
        }
        if (callCount === 3) {
          return createChain([itemExento]);
        }
        return createChain([]);
      });

      const result = await service.getLibroVentas();

      const lines = result.split('\n');
      expect(lines[1]).toContain('1000.00');
    });
  });

  describe('getLibroCompras', () => {
    it('should return headers only when no invoices', async () => {
      mockDb.select.mockImplementation(() => createChain([]));

      const result = await service.getLibroCompras();

      expect(result).toContain('Fecha|N° Factura|N° Control|RifProveedor');
    });

    it('should filter only PURCHASE invoices', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([mockPurchaseInvoice]);
        }
        return createChain([]);
      });

      const result = await service.getLibroCompras();

      expect(result.split('\n').length).toBe(2);
    });

    it('should include retention data when available', async () => {
      const retentionForInvoice = {
        ...mockRetentionIva,
        partnerId: mockPurchaseInvoice.partnerId,
        date: new Date('2024-01-20T12:00:00Z'),
      };

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([mockPurchaseInvoice]);
        }
        if (callCount === 2) {
          return createChain([mockPartner]);
        }
        if (callCount === 3) {
          return createChain([]);
        }
        if (callCount === 4) {
          return createChain([retentionForInvoice]);
        }
        return createChain([]);
      });

      const result = await service.getLibroCompras();

      const lines = result.split('\n');
      expect(lines[1]).toContain('R-IVA-001');
    });
  });

  describe('edge cases', () => {
    it('should handle invoices with null dates', async () => {
      const invoiceWithNullDate = {
        ...mockInvoice,
        date: null,
      };

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([invoiceWithNullDate]);
        }
        return createChain([]);
      });

      const result = await service.getFiscalSummary();

      expect(result.totalInvoices).toBe(1);
    });

    it('should handle partners without taxId', async () => {
      const partnerWithoutTaxId = {
        ...mockPartner,
        taxId: '',
        name: '',
      };

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([mockRetentionIva]);
        }
        if (callCount === 2) {
          return createChain([partnerWithoutTaxId]);
        }
        if (callCount === 3) {
          return createChain([mockRetentionLineIva]);
        }
        return createChain([]);
      });

      const result = await service.getRetencionesIvaTxt();

      expect(result).toContain('|');
    });

    it('should handle negative numeric values in parseNumeric', () => {
      expect((service as any)['parseNumeric'](-100)).toBe(-100);
      expect((service as any)['parseNumeric']('-100.50')).toBe(-100.5);
    });

    it('should handle string numeric values with spaces', () => {
      expect((service as any)['parseNumeric']('  100.50  ')).toBe(100.5);
    });

    it('should handle date formatting at month boundary', () => {
      const date = new Date(2024, 11, 31);
      expect((service as any)['formatDate'](date)).toBe('2024-12-31');
      expect((service as any)['formatDateForSeniat'](date)).toBe('31/12/2024');
    });

    it('should handle leap year date', () => {
      const date = new Date(2024, 1, 29);
      expect((service as any)['formatDate'](date)).toBe('2024-02-29');
    });
  });
});
