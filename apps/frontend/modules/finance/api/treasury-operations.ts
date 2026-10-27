import { apiClient } from '@/lib/api/client';

export type PaymentMethodAdmin = {
  id: string;
  name: string;
  code: string;
  isDigital?: boolean | null;
  currencyId?: string | null;
  branchId?: string | null;
  isActive?: boolean;
  appliesIgtf?: boolean;
  requiresReference?: boolean;
  isCash?: boolean;
};

export type BankAccountAdmin = {
  id: string;
  name: string;
  accountNumber?: string | null;
  type: string;
  currencyId: string;
  branchId?: string | null;
  bankId?: string | null;
  initialBalance?: number;
  currentBalance: number;
  isActive?: boolean | null;
  notes?: string | null;
};

export type StatementLine = {
  id: string;
  date: string;
  amount: number;
  direction: 'IN' | 'OUT';
  reference?: string | null;
  description?: string | null;
  matchedPaymentId?: string | null;
  matched: boolean;
  suggestions?: { paymentId: string; code: string; amount: number; date: string }[];
};

export type ReconciliationReport = {
  bankAccountId: string;
  totalLines: number;
  matchedLines: number;
  lines: StatementLine[];
  unmatchedPayments: { paymentId: string; code: string; amount: number; date: string }[];
};

export type PettyCashMovement = {
  id: string;
  date: string;
  type: 'EXPENSE' | 'REPLENISHMENT' | 'RETURN';
  amount: number;
  description?: string | null;
  receiptNumber?: string | null;
};

export type PettyCashFund = {
  id: string;
  name: string;
  currencyId: string;
  amount: number;
  balance: number;
  status: 'OPEN' | 'CLOSED';
  responsibleUserId?: string | null;
  movements: PettyCashMovement[];
  spentSinceReplenishment: number;
  replenishments?: number;
};

export type PartnerStatementMovement = {
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE';
  documentCode: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export const treasuryMethodsApi = {
  /** Sólo activos: es lo que debe elegir un cajero. */
  list: () => apiClient.get<PaymentMethodAdmin[]>('/treasury/methods'),
  listAll: () => apiClient.get<PaymentMethodAdmin[]>('/treasury/methods/all'),
  create: (data: Partial<PaymentMethodAdmin> & { name: string; code: string }) =>
    apiClient.post<PaymentMethodAdmin>('/treasury/methods', data),
  update: (id: string, data: Partial<PaymentMethodAdmin>) =>
    apiClient.patch<PaymentMethodAdmin>(`/treasury/methods/${id}`, data),
};

export const treasuryAccountsApi = {
  list: () => apiClient.get<BankAccountAdmin[]>('/treasury/bank-accounts'),
  create: (data: Partial<BankAccountAdmin> & { name: string; type: string; currencyId: string }) =>
    apiClient.post<BankAccountAdmin>('/treasury/bank-accounts', data),
  update: (id: string, data: Partial<BankAccountAdmin>) =>
    apiClient.patch<BankAccountAdmin>(`/treasury/bank-accounts/${id}`, data),
};

export const reconciliationApi = {
  report: (bankAccountId: string, range: { from?: string; to?: string } = {}) => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    const qs = params.toString();
    return apiClient.get<ReconciliationReport>(
      `/treasury/reconciliation/${bankAccountId}${qs ? `?${qs}` : ''}`
    );
  },
  importCsv: (data: { bankAccountId: string; fileName?: string; content: string }) =>
    apiClient.post<{ importId: string; linesCount: number; duplicated: boolean }>(
      '/treasury/reconciliation/import',
      data
    ),
  match: (lineId: string, paymentId: string) =>
    apiClient.post<StatementLine>(`/treasury/reconciliation/${lineId}/match`, { paymentId }),
  unmatch: (lineId: string) =>
    apiClient.post<StatementLine>(`/treasury/reconciliation/${lineId}/unmatch`, {}),
};

export const pettyCashApi = {
  list: () => apiClient.get<PettyCashFund[]>('/treasury/petty-cash'),
  create: (data: { name: string; currencyId: string; amount: number }) =>
    apiClient.post<PettyCashFund>('/treasury/petty-cash', data),
  addMovement: (
    fundId: string,
    data: {
      date: string;
      type: 'EXPENSE' | 'REPLENISHMENT';
      amount: number;
      description?: string;
      receiptNumber?: string;
    }
  ) => apiClient.post<PettyCashFund>(`/treasury/petty-cash/${fundId}/movements`, data),
  close: (fundId: string, returnedAmount: number, notes?: string) =>
    apiClient.post<PettyCashFund>(`/treasury/petty-cash/${fundId}/close`, {
      returnedAmount,
      notes,
    }),
};

export const statementsApi = {
  get: (partnerId: string, range: { from?: string; to?: string } = {}) => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    const qs = params.toString();
    return apiClient.get<{
      partnerId: string;
      partnerName: string;
      partnerTaxId: string;
      from?: string | null;
      to?: string | null;
      openingBalance?: number;
      closingBalance?: number;
      movements?: PartnerStatementMovement[];
    }>(`/treasury/statements/${partnerId}${qs ? `?${qs}` : ''}`);
  },
};
