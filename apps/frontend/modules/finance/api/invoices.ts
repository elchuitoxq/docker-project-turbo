import { apiClient } from '@/lib/api/client';

export type InvoiceStatus = 'DRAFT' | 'POSTED' | 'VOID';
export type InvoiceType = 'SALE' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';

export type InvoiceItem = {
  id?: string;
  productId: string;
  productName?: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate: number;
  isExempt?: boolean;
  subtotal: number;
  total: number;
};

export type Invoice = {
  id: string;
  code: string;
  partnerId: string;
  partnerName?: string;
  type: InvoiceType;
  status: InvoiceStatus;
  subtotal: string;
  tax: string;
  total: string;
  igtf?: string;
  applyIgtf?: boolean;
  currencyId: string;
  currencyCode?: string;
  exchangeRate?: string;
  notes?: string;
  issueDate: string;
  dueDate: string | null;
  items?: InvoiceItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type InvoiceFilters = {
  type?: InvoiceType;
  status?: InvoiceStatus;
  partnerId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  search?: string;
};

function buildQuery(filters: InvoiceFilters = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const invoicesApi = {
  list: (filters?: InvoiceFilters) =>
    apiClient.get<{ data: Invoice[]; total: number; page: number; limit: number }>(
      `/billing/invoices${buildQuery(filters)}`
    ),
  get: (id: string) => apiClient.get<Invoice>(`/billing/invoices/${id}`),
  getFiscalJson: (id: string) =>
    apiClient.get<Record<string, unknown>>(`/billing/invoices/${id}/fiscal-json`),
  create: (data: Partial<Invoice>) => apiClient.post<Invoice>('/billing/invoices', data),
  update: (id: string, data: Partial<Invoice>) =>
    apiClient.post<Invoice>(`/billing/invoices/${id}`, data),
  post: (id: string) => apiClient.post<Invoice>(`/billing/invoices/${id}/post`, {}),
  void: (id: string, reason: string) =>
    apiClient.post<Invoice>(`/billing/invoices/${id}/void`, { reason }),
  stats: () =>
    apiClient.get<{
      draft: number;
      posted: number;
      void: number;
      totalPosted: string;
    }>('/billing/invoices/stats'),
};
