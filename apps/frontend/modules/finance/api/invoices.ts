import { apiClient } from '@/lib/api/client';
import type { InvoiceDocumentDetail } from '@/modules/documents/types';

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
  /** El backend devuelve la fecha de emisión en `date` (columna `invoices.date`). */
  date: string;
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
  paginated?: string;
};

function buildQuery(filters: InvoiceFilters = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Cuerpo de `POST /v1/billing/invoices`: el folio y el código los asigna el backend. */
export type CreateInvoicePayload = {
  partnerId: string;
  warehouseId?: string;
  currencyId?: string;
  type?: 'SALE' | 'PURCHASE';
  exchangeRate?: number;
  dueDate?: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
  items: { productId: string; quantity: number; price: number; taxRate?: number }[];
};

/** Cuerpo de `PATCH /v1/billing/invoices/:id` (sólo borradores). */
export type UpdateInvoicePayload = {
  partnerId?: string;
  dueDate?: string;
  /** Tasa de la factura: `base = monto × exchangeRate`. */
  exchangeRate?: number;
  items?: {
    productId: string;
    quantity: number;
    price: number;
    taxRate?: number;
    /** Moneda de `price`; si se omite, se asume la del documento. */
    priceCurrencyId?: string;
  }[];
};

export const invoicesApi = {
  list: (filters?: InvoiceFilters) =>
    apiClient.get<{ data: Invoice[]; total: number; page: number; limit: number }>(
      `/billing/invoices${buildQuery({ ...filters, paginated: 'true' })}`
    ),
  get: (id: string) => apiClient.get<Invoice>(`/billing/invoices/${id}`),
  getDetail: (id: string) => apiClient.get<InvoiceDocumentDetail>(`/billing/invoices/${id}`),
  getFiscalJson: (id: string) =>
    apiClient.get<Record<string, unknown>>(`/billing/invoices/${id}/fiscal-json`),
  create: (data: CreateInvoicePayload) =>
    apiClient.post<{ id: string; code: string }>('/billing/invoices', data),
  update: (id: string, data: UpdateInvoicePayload) =>
    apiClient.patch<Invoice>(`/billing/invoices/${id}`, data),
  post: (id: string) => apiClient.post<Invoice>(`/billing/invoices/${id}/post`, {}),
  void: (id: string, reason: string) =>
    apiClient.post<Invoice>(`/billing/invoices/${id}/void`, { reason }),
  stats: (type?: 'SALE' | 'PURCHASE') =>
    apiClient.get<{
      totalCount: number;
      totalAmount: number;
      draftCount: number;
      postedCount: number;
      paidCount: number;
      voidCount: number;
    }>(type ? `/billing/invoices/stats?type=${type}` : '/billing/invoices/stats'),
};
