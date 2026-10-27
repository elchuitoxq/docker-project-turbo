import { apiClient } from '@/lib/api/client';

export type LoanStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'PAID' | 'CANCELLED';
export type LoanType = 'QUOTA' | 'ADVANCE';

export type LoanItemKind = 'DELIVERED' | 'RETURNED';

export type LoanItem = {
  id: string;
  productId: string;
  quantity: number;
  serialNumber: string | null;
  condition: string | null;
  kind: LoanItemKind;
};

export type Loan = {
  id: string;
  code: string;
  partnerId: string;
  status: LoanStatus;
  type?: LoanType;
  startDate: string | null;
  dueDate: string | null;
  returnDate: string | null;
  notes: string | null;
  items: LoanItem[];
};

export type CreateLoanPayload = {
  code: string;
  partnerId: string;
  type?: LoanType;
  dueDate?: string;
  notes?: string;
  items?: Array<{ productId: string; quantity: number; serialNumber?: string; condition?: string }>;
};

/**
 * Préstamos (`T-07-03`).
 *
 * Ojo con el alcance: `loans` + `loan_items` modela **préstamo de artículos** (producto, serie,
 * condición de devolución), no préstamos de dinero. `pay` registra las devoluciones, no pagos.
 */
export const loansApi = {
  list: (filters: { employeeId?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return apiClient.get<Loan[] | { data: Loan[]; total: number }>(`/loans${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiClient.get<Loan>(`/loans/${id}`),
  create: (payload: CreateLoanPayload) => apiClient.post<Loan>('/loans', payload),
  approve: (id: string) => apiClient.post<Loan>(`/loans/${id}/approve`, {}),
  reject: (id: string) => apiClient.post<Loan>(`/loans/${id}/reject`, {}),
  registerReturn: (
    id: string,
    items: Array<{ productId: string; quantity: number; serialNumber?: string; condition?: string }>
  ) => apiClient.post<Loan>(`/loans/${id}/pay`, { items }),
};

export function toLoanList(data: Loan[] | { data: Loan[]; total: number } | undefined): Loan[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.data;
}

/** Totales entregados/devueltos de un préstamo, a partir de `loan_items.kind` (H-99). */
export function loanItemTotals(loan: Loan): { delivered: number; returned: number } {
  let delivered = 0;
  let returned = 0;

  for (const item of loan.items ?? []) {
    if (item.kind === 'RETURNED') returned += item.quantity;
    else delivered += item.quantity;
  }

  return { delivered, returned };
}
