import { apiClient } from '@/lib/api/client';

export type Order = {
  id: string;
  code: string;
  partnerId: string;
  partnerName?: string;
  type: 'SALE' | 'PURCHASE';
  status: 'PENDING' | 'APPROVED' | 'INVOICED' | 'CANCELLED';
  total: string;
  currencyCode: string;
  orderDate: string;
  deliveryDate: string | null;
  notes?: string;
};

function buildQuery(filters: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const ordersApi = {
  list: (filters: { type?: 'SALE' | 'PURCHASE'; status?: string; page?: number; limit?: number } = {}) =>
    apiClient.get<{ data: Order[]; total: number; page: number; limit: number }>(`/orders${buildQuery(filters)}`),
  get: (id: string) => apiClient.get<Order>(`/orders/${id}`),
};
