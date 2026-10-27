import { apiClient } from '@/lib/api/client';

export type BankAccount = {
  id: string;
  bankId: string;
  bankName?: string;
  accountNumber: string;
  accountType: 'CHECKING' | 'SAVINGS';
  currencyId: string;
  currencyCode?: string;
  isActive: boolean;
  balance?: string;
};

export type Payment = {
  id: string;
  code: string;
  partnerId: string;
  partnerName?: string;
  bankAccountId: string;
  bankAccount?: BankAccount;
  type: 'INBOUND' | 'OUTBOUND';
  amount: string;
  currencyId: string;
  currencyCode?: string;
  exchangeRate?: string;
  date: string;
  reference?: string;
  notes?: string;
  status: 'PENDING' | 'CONFIRMED' | 'VOID';
};

export type PaymentMethod = {
  id: string;
  name: string;
  code: string;
  isDigital?: boolean | null;
  currencyId?: string | null;
  branchId?: string | null;
};

export const treasuryApi = {
  listAccounts: () => apiClient.get<BankAccount[]>('/treasury/bank-accounts'),
  listMethods: () => apiClient.get<PaymentMethod[]>('/treasury/methods'),
  listPayments: (
    filters: { type?: 'INBOUND' | 'OUTBOUND'; status?: string; page?: number; limit?: number } = {}
  ) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, String(v));
    const qs = params.toString();
    return apiClient.get<{ data: Payment[]; total: number }>(
      `/treasury/payments${qs ? `?${qs}` : ''}`
    );
  },
  createPayment: (data: Partial<Payment>) => apiClient.post<Payment>('/treasury/payments', data),
  voidPayment: (id: string, reason: string) =>
    apiClient.post<Payment>(`/treasury/payments/${id}/void`, { reason }),
};
