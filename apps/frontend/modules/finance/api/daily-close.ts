import { apiClient } from '@/lib/api/client';

export type DailyCloseStatus = 'OPEN' | 'CLOSED';

export type DailyClose = {
  date: string;
  status: DailyCloseStatus;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  cashCount?: number | null;
  openingCash?: number | null;
  expectedCash?: number | null;
  difference?: number | null;
  byPaymentMethod: { methodName: string; income: number; expense: number }[];
  byCurrency: { currencyCode: string; income: number; expense: number }[];
  paymentsCount: number;
  closedAt?: string | null;
  closedBy?: string | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  notes?: string | null;
};

export type ClosePayload = { notes?: string; cashCount?: number; openingCash?: number };

/**
 * Cierre diario por sucursal (`T-05-03`).
 *
 * Las tres rutas estan parametrizadas por fecha: no existe un listado global, porque el cierre es un
 * acto sobre un dia concreto.
 */
export const dailyCloseApi = {
  get: (date: string) => apiClient.get<DailyClose>(`/treasury/daily-close/${date}`),
  close: (date: string, payload: ClosePayload = {}) =>
    apiClient.post<DailyClose>(`/treasury/daily-close/${date}/close`, payload),
  reopen: (date: string, reason: string) =>
    apiClient.post<DailyClose>(`/treasury/daily-close/${date}/reopen`, { reason }),
};
