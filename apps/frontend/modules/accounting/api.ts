import { apiClient } from '@/lib/api/client';

export type AccountType =
  'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'COST' | 'ORDER';

export type EntryStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export type EntrySourceType =
  'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'PAYROLL' | 'INVENTORY' | 'MANUAL';

export type PeriodStatus = 'OPEN' | 'CLOSED';

/** Refleja `AccountResponseDto` / `AccountTreeDto` del backend. */
export type Account = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  branchId: string | null;
  parentId: string | null;
  isPostable: boolean;
  isActive: boolean;
};

export type AccountNode = Account & { children: AccountNode[] };

export type EntryLine = {
  id?: string;
  accountId: string;
  accountCode?: string | null;
  accountName?: string | null;
  debit: number;
  credit: number;
  description?: string | null;
  originalAmount?: number | null;
  originalCurrencyId?: string | null;
};

export type Entry = {
  id: string;
  date: string | null;
  description: string;
  reference: string | null;
  branchId: string | null;
  branchName: string | null;
  status: EntryStatus;
  sourceType?: string | null;
  sourceId?: string | null;
  postedAt?: string | null;
  userId?: string | null;
  userName?: string | null;
  createdAt?: string | null;
  lines: EntryLine[];
};

export type Period = {
  id: string;
  year: number;
  month: number;
  status: PeriodStatus;
  closedAt?: string | null;
  closedBy?: string | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  entries?: number;
  totalDebit?: number;
  totalCredit?: number;
};

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalance = {
  from: string | null;
  to: string | null;
  rows: TrialBalanceRow[];
  totals: { debit: number; credit: number; difference: number };
  balanced: boolean;
};

export type StatementLine = {
  accountId: string;
  code: string;
  name: string;
  balance: number;
};

export type BalanceSheet = {
  date: string;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
    result: number;
    liabilitiesAndEquity: number;
    difference: number;
  };
  balanced: boolean;
};

export type IncomeStatement = {
  from: string | null;
  to: string | null;
  revenue: StatementLine[];
  costs: StatementLine[];
  expenses: StatementLine[];
  totals: {
    revenue: number;
    costs: number;
    grossProfit: number;
    expenses: number;
    result: number;
  };
};

export type CreateAccountBody = {
  code: string;
  name: string;
  type: AccountType;
  branchId?: string;
  parentId?: string;
  isPostable?: boolean;
};

export type UpdateAccountBody = Partial<{
  name: string;
  type: AccountType;
  parentId: string | null;
  isPostable: boolean;
  isActive: boolean;
}>;

export type CreateEntryBody = {
  date: string;
  description: string;
  reference?: string | null;
  branchId?: string;
  lines: Array<{
    accountId: string;
    debit?: number;
    credit?: number;
    description?: string;
  }>;
  status?: EntryStatus;
};

function buildQuery(filters: Record<string, string | number | boolean | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const accountingApi = {
  listAccounts: () => apiClient.get<AccountNode[]>('/accounting/accounts'),
  createAccount: (body: CreateAccountBody) => apiClient.post<Account>('/accounting/accounts', body),
  updateAccount: (id: string, body: UpdateAccountBody) =>
    apiClient.patch<Account>(`/accounting/accounts/${id}`, body),
  deleteAccount: (id: string) =>
    apiClient.delete<{ deleted: true; deactivated: true }>(`/accounting/accounts/${id}`),

  listEntries: (
    filters: { from?: string; to?: string; sourceType?: EntrySourceType; accountId?: string } = {}
  ) => apiClient.get<Entry[]>(`/accounting/entries${buildQuery(filters)}`),
  getEntry: (id: string) => apiClient.get<Entry>(`/accounting/entries/${id}`),
  createEntry: (body: CreateEntryBody) => apiClient.post<Entry>('/accounting/entries', body),
  updateEntry: (id: string, body: Partial<CreateEntryBody>) =>
    apiClient.patch<Entry>(`/accounting/entries/${id}`, body),
  postEntry: (id: string) => apiClient.post<Entry>(`/accounting/entries/${id}/post`, {}),

  listPeriods: (year: number) =>
    apiClient.get<Period[]>(`/accounting/periods${buildQuery({ year })}`),
  closePeriod: (id: string) => apiClient.post<Period>(`/accounting/periods/${id}/close`, {}),
  reopenPeriod: (id: string, reason: string) =>
    apiClient.post<Period>(`/accounting/periods/${id}/reopen`, { reason }),

  trialBalance: (from?: string, to?: string) =>
    apiClient.get<TrialBalance>(`/reports/trial-balance${buildQuery({ from, to })}`),
  balanceSheet: (date?: string) =>
    apiClient.get<BalanceSheet>(`/reports/balance-sheet${buildQuery({ date })}`),
  incomeStatement: (from?: string, to?: string) =>
    apiClient.get<IncomeStatement>(`/reports/income-statement${buildQuery({ from, to })}`),
};
