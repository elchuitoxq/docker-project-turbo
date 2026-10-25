import { apiClient } from '@/lib/api/client';

export type KpiCard = {
  id: string;
  title: string;
  value: number;
  formatted: string;
  change: number;
  changeLabel: string;
  icon: string;
  variant: 'default' | 'warning' | 'success' | 'destructive';
};

export type ChartPoint = {
  date: string;
  income: number;
  expense: number;
};

export type ActivityItem = {
  id: string;
  type: 'INVOICE' | 'PAYMENT' | 'MOVE' | 'INCIDENT' | 'EMPLOYEE';
  title: string;
  description: string;
  userName?: string;
  timestamp: string;
  link?: string;
};

export const biApi = {
  kpis: (filters: { branchId?: string; fromDate?: string; toDate?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, String(v));
    const qs = params.toString();
    return apiClient.get<KpiCard[]>(`/bi/kpis${qs ? `?${qs}` : ''}`);
  },
  chart: (filters: { branchId?: string; fromDate?: string; toDate?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, String(v));
    const qs = params.toString();
    return apiClient.get<ChartPoint[]>(`/bi/chart${qs ? `?${qs}` : ''}`);
  },
  activity: (filters: { branchId?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, String(v));
    const qs = params.toString();
    return apiClient.get<ActivityItem[]>(`/bi/activity${qs ? `?${qs}` : ''}`);
  },
};
