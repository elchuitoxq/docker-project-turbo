import { Injectable } from '@nestjs/common';
import { db } from '../../database';
import {
  invoices,
  payments,
  employees,
  payrollRuns,
  creditNotes,
  orders,
  partners,
} from '../../schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';

export interface KpiResult {
  totalInvoicesPosted: { count: number; sum: number };
  totalPaymentsPosted: { count: number; sum: number };
  totalEmployees: { count: number };
  pendingPayrollRuns: { count: number };
  totalCreditNotes: { count: number; sum: number };
}

export interface MonthlyData {
  month: number;
  monthName: string;
  total: number;
  count: number;
}

export interface ChartResult {
  monthlySales: MonthlyData[];
  monthlyPayments: MonthlyData[];
}

export interface RecentInvoice {
  id: string;
  code: string;
  partnerName: string | null;
  total: number;
  status: string | undefined;
  date: Date | null;
}

export interface RecentPayment {
  id: string;
  code: string;
  partnerName: string | null;
  amount: number;
  status: string | undefined;
  date: Date | null;
}

export interface RecentOrder {
  id: string;
  code: string;
  partnerName: string | null;
  total: number;
  status: string | undefined;
  date: Date | null;
}

export interface ActivityResult {
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
  recentOrders: RecentOrder[];
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Injectable()
export class BiService {
  async getKpis(): Promise<KpiResult> {
    const postedInvoices = await db
      .select({
        count: sql<number>`count(*)`,
        sum: sql<number>`coalesce(sum(${invoices.total}::numeric), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.status, 'POSTED'));

    const postedPayments = await db
      .select({
        count: sql<number>`count(*)`,
        sum: sql<number>`coalesce(sum(${payments.amountBase}::numeric), 0)`,
      })
      .from(payments)
      .where(eq(payments.status, 'POSTED'));

    const activeEmployees = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(employees)
      .where(eq(employees.status, 'ACTIVE'));

    const pendingPayroll = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(payrollRuns)
      .where(and(sql`${payrollRuns.status} != 'PAID'`, sql`${payrollRuns.status} != 'CANCELLED'`));

    const postedCreditNotes = await db
      .select({
        count: sql<number>`count(*)`,
        sum: sql<number>`coalesce(sum(${creditNotes.total}::numeric), 0)`,
      })
      .from(creditNotes)
      .where(eq(creditNotes.status, 'POSTED'));

    return {
      totalInvoicesPosted: {
        count: Number(postedInvoices[0]?.count) || 0,
        sum: Number(postedInvoices[0]?.sum) || 0,
      },
      totalPaymentsPosted: {
        count: Number(postedPayments[0]?.count) || 0,
        sum: Number(postedPayments[0]?.sum) || 0,
      },
      totalEmployees: {
        count: Number(activeEmployees[0]?.count) || 0,
      },
      pendingPayrollRuns: {
        count: Number(pendingPayroll[0]?.count) || 0,
      },
      totalCreditNotes: {
        count: Number(postedCreditNotes[0]?.count) || 0,
        sum: Number(postedCreditNotes[0]?.sum) || 0,
      },
    };
  }

  async getChartData(type: 'sales' | 'payments', year: number): Promise<MonthlyData[]> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    if (type === 'sales') {
      const monthlySales = await db
        .select({
          month: sql<number>`extract(month from ${invoices.date})`,
          total: sql<number>`coalesce(sum(${invoices.total}::numeric), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.status, 'POSTED'),
            gte(invoices.date, startDate),
            lte(invoices.date, endDate)
          )
        )
        .groupBy(sql`extract(month from ${invoices.date})`)
        .orderBy(sql`extract(month from ${invoices.date})`);

      return this.formatMonthlyData(monthlySales, year);
    } else {
      const monthlyPayments = await db
        .select({
          month: sql<number>`extract(month from ${payments.date})`,
          total: sql<number>`coalesce(sum(${payments.amountBase}::numeric), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.status, 'POSTED'),
            gte(payments.date, startDate),
            lte(payments.date, endDate)
          )
        )
        .groupBy(sql`extract(month from ${payments.date})`)
        .orderBy(sql`extract(month from ${payments.date})`);

      return this.formatMonthlyData(monthlyPayments, year);
    }
  }

  private formatMonthlyData(
    data: { month: number; total: string | number; count: number }[],
    year: number
  ): MonthlyData[] {
    const result: MonthlyData[] = [];

    for (let i = 1; i <= 12; i++) {
      const monthData = data.find(d => Number(d.month) === i);
      result.push({
        month: i,
        monthName: MONTH_NAMES[i - 1],
        total: monthData ? Number(monthData.total) : 0,
        count: monthData ? Number(monthData.count) : 0,
      });
    }

    return result;
  }

  async getActivity(): Promise<ActivityResult> {
    const recentInvoicesRaw = await db
      .select({
        id: invoices.id,
        code: invoices.code,
        partnerId: invoices.partnerId,
        total: invoices.total,
        status: invoices.status,
        date: invoices.date,
      })
      .from(invoices)
      .where(eq(invoices.status, 'POSTED'))
      .orderBy(desc(invoices.createdAt))
      .limit(10);

    const recentPaymentsRaw = await db
      .select({
        id: payments.id,
        code: payments.code,
        partnerId: payments.partnerId,
        amount: payments.amount,
        status: payments.status,
        date: payments.date,
      })
      .from(payments)
      .where(eq(payments.status, 'POSTED'))
      .orderBy(desc(payments.createdAt))
      .limit(10);

    const recentOrdersRaw = await db
      .select({
        id: orders.id,
        code: orders.code,
        partnerId: orders.partnerId,
        total: orders.total,
        status: orders.status,
        date: orders.date,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(10);

    const partnerIds = [
      ...new Set([
        ...recentInvoicesRaw.map(i => i.partnerId),
        ...recentPaymentsRaw.map(p => p.partnerId),
        ...recentOrdersRaw.map(o => o.partnerId),
      ]),
    ];

    const partnersRaw =
      partnerIds.length > 0
        ? await db.select({ id: partners.id, name: partners.name }).from(partners)
        : [];

    const partnerMap = new Map(partnersRaw.map(p => [p.id, p.name]));

    const recentInvoices: RecentInvoice[] = recentInvoicesRaw.map(inv => ({
      id: inv.id,
      code: inv.code,
      partnerName: partnerMap.get(inv.partnerId) || null,
      total: Number(inv.total),
      status: inv.status || undefined,
      date: inv.date,
    }));

    const recentPayments: RecentPayment[] = recentPaymentsRaw.map(pay => ({
      id: pay.id,
      code: pay.code,
      partnerName: (pay.partnerId ? partnerMap.get(pay.partnerId) : null) || null,
      amount: Number(pay.amount),
      status: pay.status || undefined,
      date: pay.date,
    }));

    const recentOrders: RecentOrder[] = recentOrdersRaw.map(ord => ({
      id: ord.id,
      code: ord.code,
      partnerName: partnerMap.get(ord.partnerId) || null,
      total: Number(ord.total),
      status: ord.status || undefined,
      date: ord.date,
    }));

    return {
      recentInvoices,
      recentPayments,
      recentOrders,
    };
  }
}
