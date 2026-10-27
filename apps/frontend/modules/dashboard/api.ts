import { apiClient } from '@/lib/api/client';

export type KpiResult = {
  totalInvoicesPosted: { count: number; sum: number };
  totalPaymentsPosted: { count: number; sum: number };
  totalEmployees: { count: number };
  pendingPayrollRuns: { count: number };
  totalCreditNotes: { count: number; sum: number };
};

export type MonthlyData = {
  month: number;
  monthName: string;
  total: number;
  count: number;
};

export type ActivityResult = {
  recentInvoices: Array<{
    id: string;
    code: string;
    partnerName: string | null;
    total: number;
    status?: string;
    date: string | null;
  }>;
  recentPayments: Array<{
    id: string;
    code: string;
    partnerName: string | null;
    amount: number;
    status?: string;
    date: string | null;
  }>;
  recentOrders: Array<{
    id: string;
    code: string;
    partnerName: string | null;
    total: number;
    status?: string;
    date: string | null;
  }>;
};

/** Indicadores del panel (`T-07-05`). */
export const biApi = {
  kpis: () => apiClient.get<KpiResult>('/bi/kpis'),
  chart: (type: 'sales' | 'payments', year: number) =>
    apiClient.get<MonthlyData[]>(`/bi/chart?type=${type}&year=${year}`),
  activity: () => apiClient.get<ActivityResult>('/bi/activity'),
};
