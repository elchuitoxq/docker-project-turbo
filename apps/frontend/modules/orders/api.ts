import { apiClient } from '@/lib/api/client';

export type Invoice = {
  id: string;
  code: string;
  partnerId: string;
  partnerName?: string;
  type: 'SALE' | 'PURCHASE';
  status: 'DRAFT' | 'POSTED' | 'VOID';
  total: string;
  tax: string;
  currencyCode: string;
  issueDate: string;
  dueDate: string | null;
};

function buildQuery(filters: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const invoicesApi = {
  list: (
    filters: { type?: 'SALE' | 'PURCHASE'; status?: string; page?: number; limit?: number } = {}
  ) =>
    apiClient.get<{ data: Invoice[]; total: number; page: number; limit: number }>(
      `/billing/invoices${buildQuery(filters)}`
    ),
  get: (id: string) => apiClient.get<Invoice>(`/billing/invoices/${id}`),
  post: (id: string) => apiClient.post<Invoice>(`/billing/invoices/${id}/post`, {}),
  void: (id: string, reason: string) =>
    apiClient.post<Invoice>(`/billing/invoices/${id}/void`, { reason }),
};
