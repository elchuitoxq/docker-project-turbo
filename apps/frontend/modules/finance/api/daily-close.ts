import { apiClient } from '@/lib/api/client';

export type DailyClose = {
  id: string;
  date: string;
  status: 'OPEN' | 'CLOSED' | 'REVIEWED';
  totalInflow: string;
  totalOutflow: string;
  netMovement: string;
  closedAt?: string;
  closedBy?: string;
  notes?: string;
};

export const dailyCloseApi = {
  list: (filters: { fromDate?: string; toDate?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, String(v));
    const qs = params.toString();
    return apiClient.get<{ data: DailyClose[]; total: number }>(
      `/treasury/daily-close${qs ? `?${qs}` : ''}`
    );
  },
  get: (date: string) => apiClient.get<DailyClose>(`/treasury/daily-close/${date}`),
  close: (date: string, notes?: string) =>
    apiClient.post<DailyClose>(`/treasury/daily-close/${date}/close`, { notes }),
  reopen: (date: string, reason: string) =>
    apiClient.post<DailyClose>(`/treasury/daily-close/${date}/reopen`, { reason }),
};
