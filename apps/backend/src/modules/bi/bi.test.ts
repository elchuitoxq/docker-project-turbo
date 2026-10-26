import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BiService } from './bi.service';
import { db } from '../../database';

const createQueryBuilder = (resolveData: any) => {
  const builder: any = {
    then: (onfulfilled: any) => {
      return Promise.resolve(resolveData).then(onfulfilled);
    },
  };
  builder.from = () => builder;
  builder.where = () => builder;
  builder.groupBy = () => builder;
  builder.orderBy = () => builder;
  builder.limit = () => builder;
  return builder;
};

vi.mock('../../database', () => ({
  db: {
    select: vi.fn(() => createQueryBuilder([])),
  },
}));

vi.mock('../../schema', () => ({
  invoices: 'invoices',
  payments: 'payments',
  employees: 'employees',
  payrollRuns: 'payrollRuns',
  creditNotes: 'creditNotes',
  orders: 'orders',
  partners: 'partners',
}));

describe('BiService', () => {
  let service: BiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BiService();
  });

  describe('getKpis', () => {
    it('should return KPIs with zero values when no data exists', async () => {
      vi.mocked(db.select).mockReturnValue(createQueryBuilder([{ count: 0, sum: 0 }]) as any);

      const result = await service.getKpis();

      expect(result).toEqual({
        totalInvoicesPosted: { count: 0, sum: 0 },
        totalPaymentsPosted: { count: 0, sum: 0 },
        totalEmployees: { count: 0 },
        pendingPayrollRuns: { count: 0 },
        totalCreditNotes: { count: 0, sum: 0 },
      });
    });

    it('should return correct KPIs when data exists', async () => {
      const callResults = [
        [{ count: 10, sum: 50000 }],
        [{ count: 25, sum: 30000 }],
        [{ count: 15 }],
        [{ count: 3 }],
        [{ count: 5, sum: 2000 }],
      ];
      let callIndex = 0;
      vi.mocked(db.select).mockImplementation(
        () => createQueryBuilder(callResults[callIndex++]) as any
      );

      const result = await service.getKpis();

      expect(result.totalInvoicesPosted).toEqual({ count: 10, sum: 50000 });
      expect(result.totalPaymentsPosted).toEqual({ count: 25, sum: 30000 });
      expect(result.totalEmployees).toEqual({ count: 15 });
      expect(result.pendingPayrollRuns).toEqual({ count: 3 });
      expect(result.totalCreditNotes).toEqual({ count: 5, sum: 2000 });
    });

    it('should handle null/undefined counts and sums gracefully', async () => {
      vi.mocked(db.select).mockReturnValue(createQueryBuilder([{ count: null, sum: null }]) as any);

      const result = await service.getKpis();

      expect(result.totalInvoicesPosted).toEqual({ count: 0, sum: 0 });
      expect(result.totalPaymentsPosted).toEqual({ count: 0, sum: 0 });
      expect(result.totalCreditNotes).toEqual({ count: 0, sum: 0 });
    });
  });

  describe('getChartData', () => {
    it('should return monthly sales data for a given year', async () => {
      const mockSalesData = [
        { month: 1, total: '10000', count: 5 },
        { month: 2, total: '15000', count: 8 },
        { month: 6, total: '20000', count: 10 },
      ];
      vi.mocked(db.select).mockReturnValue(createQueryBuilder(mockSalesData) as any);

      const result = await service.getChartData('sales', 2024);

      expect(result).toHaveLength(12);
      expect(result[0]).toEqual({ month: 1, monthName: 'Enero', total: 10000, count: 5 });
      expect(result[1]).toEqual({ month: 2, monthName: 'Febrero', total: 15000, count: 8 });
      expect(result[5]).toEqual({ month: 6, monthName: 'Junio', total: 20000, count: 10 });
      expect(result[3]).toEqual({ month: 4, monthName: 'Abril', total: 0, count: 0 });
    });

    it('should return monthly payments data for a given year', async () => {
      const mockPaymentsData = [
        { month: 3, total: '5000', count: 3 },
        { month: 9, total: '8000', count: 4 },
      ];
      vi.mocked(db.select).mockReturnValue(createQueryBuilder(mockPaymentsData) as any);

      const result = await service.getChartData('payments', 2024);

      expect(result).toHaveLength(12);
      expect(result[8]).toEqual({ month: 9, monthName: 'Septiembre', total: 8000, count: 4 });
      expect(result[2]).toEqual({ month: 3, monthName: 'Marzo', total: 5000, count: 3 });
    });

    it('should return all months with zero values when no data exists', async () => {
      vi.mocked(db.select).mockReturnValue(createQueryBuilder([]) as any);

      const result = await service.getChartData('sales', 2024);

      expect(result).toHaveLength(12);
      result.forEach(month => {
        expect(month.total).toBe(0);
        expect(month.count).toBe(0);
      });
    });
  });

  describe('getActivity', () => {
    it('should return recent invoices, payments, and orders', async () => {
      const mockInvoices = [
        {
          id: 'inv1',
          code: 'INV-001',
          partnerId: 'p1',
          total: 1000,
          status: 'POSTED',
          date: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'inv2',
          code: 'INV-002',
          partnerId: 'p2',
          total: 2000,
          status: 'POSTED',
          date: new Date(),
          createdAt: new Date(),
        },
      ];
      const mockPayments = [
        {
          id: 'pay1',
          code: 'PAY-001',
          partnerId: 'p1',
          amount: 500,
          status: 'POSTED',
          date: new Date(),
          createdAt: new Date(),
        },
      ];
      const mockOrders = [
        {
          id: 'ord1',
          code: 'ORD-001',
          partnerId: 'p1',
          total: 800,
          status: 'DRAFT',
          date: new Date(),
          createdAt: new Date(),
        },
      ];
      const mockPartners = [
        { id: 'p1', name: 'Partner One' },
        { id: 'p2', name: 'Partner Two' },
      ];
      const callResults = [mockInvoices, mockPayments, mockOrders, mockPartners];
      let callIndex = 0;
      vi.mocked(db.select).mockImplementation(
        () => createQueryBuilder(callResults[callIndex++]) as any
      );

      const result = await service.getActivity();

      expect(result.recentInvoices).toHaveLength(2);
      expect(result.recentPayments).toHaveLength(1);
      expect(result.recentOrders).toHaveLength(1);
      expect(result.recentInvoices[0].partnerName).toBe('Partner One');
      expect(result.recentInvoices[1].partnerName).toBe('Partner Two');
      expect(result.recentPayments[0].partnerName).toBe('Partner One');
    });

    it('should return empty arrays when no activity exists', async () => {
      const callResults = [[], [], [], []];
      let callIndex = 0;
      vi.mocked(db.select).mockImplementation(
        () => createQueryBuilder(callResults[callIndex++]) as any
      );

      const result = await service.getActivity();

      expect(result.recentInvoices).toEqual([]);
      expect(result.recentPayments).toEqual([]);
      expect(result.recentOrders).toEqual([]);
    });

    it('should handle null partnerName when partner not found', async () => {
      const mockInvoices = [
        {
          id: 'inv1',
          code: 'INV-001',
          partnerId: 'unknown-partner',
          total: 1000,
          status: 'POSTED',
          date: new Date(),
          createdAt: new Date(),
        },
      ];
      const callResults = [mockInvoices, [], [], []] as any;
      let callIndex = 0;
      vi.mocked(db.select).mockImplementation(
        () => createQueryBuilder(callResults[callIndex++]) as any
      );

      const result = await service.getActivity();

      expect(result.recentInvoices[0].partnerName).toBeNull();
    });

    it('should handle null partnerId in raw data', async () => {
      const mockInvoices = [
        {
          id: 'inv1',
          code: 'INV-001',
          partnerId: null,
          total: 1000,
          status: 'POSTED',
          date: new Date(),
          createdAt: new Date(),
        },
      ];
      const callResults = [mockInvoices, [], [], []] as any;
      let callIndex = 0;
      vi.mocked(db.select).mockImplementation(
        () => createQueryBuilder(callResults[callIndex++]) as any
      );

      const result = await service.getActivity();

      expect(result.recentInvoices[0].partnerName).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle non-2000 year dates correctly', async () => {
      const mockData = [{ month: 12, total: '25000', count: 12 }];
      vi.mocked(db.select).mockReturnValue(createQueryBuilder(mockData) as any);

      const result = await service.getChartData('sales', 1999);

      expect(result[11].month).toBe(12);
      expect(result[11].total).toBe(25000);
    });

    it('should handle leap year correctly', async () => {
      vi.mocked(db.select).mockReturnValue(createQueryBuilder([]) as any);

      const result = await service.getChartData('sales', 2024);

      expect(result).toHaveLength(12);
      expect(result.find(m => m.month === 2)).toBeDefined();
    });

    it('should convert string totals to numbers', async () => {
      const mockData = [{ month: 1, total: '12345.67', count: 5 }];
      vi.mocked(db.select).mockReturnValue(createQueryBuilder(mockData) as any);

      const result = await service.getChartData('sales', 2024);

      expect(result[0].total).toBe(12345.67);
    });
  });
});
