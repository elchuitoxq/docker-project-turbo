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
  /** `INCOME` cobra al cliente; `EXPENSE` paga al proveedor. `direction` lo deriva el backend. */
  type: 'INCOME' | 'EXPENSE';
  direction?: 'IN' | 'OUT';
  amount: string;
  currencyId: string;
  currencyCode?: string;
  exchangeRate?: string;
  date: string;
  reference?: string;
  notes?: string;
  status: 'PENDING' | 'POSTED' | 'VOID';
};

export type PaymentAllocation = { invoiceId: string; amount: number };

export type CreatePaymentPayload = {
  partnerId: string;
  branchId?: string;
  methodId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  currencyId: string;
  exchangeRate: number;
  bankAccountId?: string;
  reference?: string;
  retentionAmount?: number;
  /** Asignación a facturas; el backend rechaza sobreasignar el saldo (`S-03` regla 4). */
  allocations?: PaymentAllocation[];
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
    filters: { type?: 'INCOME' | 'EXPENSE'; status?: string; page?: number; limit?: number } = {}
  ) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, String(v));
    const qs = params.toString();
    return apiClient.get<{ data: Payment[]; total: number }>(
      `/treasury/payments${qs ? `?${qs}` : ''}`
    );
  },
  createPayment: (data: CreatePaymentPayload) =>
    apiClient.post<Payment>('/treasury/payments', data),
  voidPayment: (id: string, reason: string) =>
    apiClient.post<Payment>(`/treasury/payments/${id}/void`, { reason }),
};
