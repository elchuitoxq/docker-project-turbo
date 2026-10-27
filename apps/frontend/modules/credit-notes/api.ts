import { apiClient } from '@/lib/api/client';

export type CreditNoteStatus = 'DRAFT' | 'POSTED' | 'VOIDED' | 'APPLIED';

export type CreditNote = {
  id: string;
  code: string;
  type: 'SALE' | 'PURCHASE';
  invoiceId: string | null;
  partnerId: string;
  branchId: string;
  currencyId: string;
  exchangeRate: number;
  status: CreditNoteStatus;
  totalBase: number;
  totalTax: number;
  totalIgtf: number;
  total: number;
  availableAmount: number;
  date: string | null;
  items: Array<{ id: string; productId: string; quantity: number; price: number; total?: number }>;
  usages: Array<{ id: string; invoiceId: string; amount: number }>;
};

export type CreateCreditNotePayload = {
  type?: 'SALE' | 'PURCHASE';
  invoiceId?: string;
  partnerId: string;
  branchId?: string;
  currencyId: string;
  exchangeRate: number;
  date?: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
};

/**
 * Notas de crédito (`T-07-02`).
 *
 * La aplicación a una factura devuelve el saldo actualizado; el backend rechaza aplicar más que el
 * disponible de la nota o el saldo de la factura.
 */
export const creditNotesApi = {
  list: (filters: { partnerId?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return apiClient.get<CreditNote[] | { data: CreditNote[]; total: number }>(
      `/credit-notes${qs ? `?${qs}` : ''}`
    );
  },
  get: (id: string) => apiClient.get<CreditNote>(`/credit-notes/${id}`),
  create: (payload: CreateCreditNotePayload) =>
    apiClient.post<CreditNote>('/credit-notes', payload),
  post: (id: string) => apiClient.post<CreditNote>(`/credit-notes/${id}/post`, {}),
  void: (id: string) => apiClient.post<CreditNote>(`/credit-notes/${id}/void`, {}),
  apply: (id: string, invoiceId: string, amount: number) =>
    apiClient.post<{
      id: string;
      invoiceId: string;
      amount: number;
      availableAmount: number;
    }>(`/credit-notes/${id}/apply/${invoiceId}`, { amount }),
};

/** Normaliza la respuesta del listado (arreglo plano o paginado). */
export function toCreditNoteList(
  data: CreditNote[] | { data: CreditNote[]; total: number } | undefined
): CreditNote[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.data;
}
