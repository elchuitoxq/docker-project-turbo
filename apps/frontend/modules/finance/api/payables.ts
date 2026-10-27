import { apiClient } from '@/lib/api/client';

/** Estados de una cuenta por pagar (`S-03`). */
export type PayableStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export type AgingBucket = 'CURRENT' | 'D1_30' | 'D31_60' | 'D61_90' | 'D90_PLUS';

export type Payable = {
  invoiceId: string;
  code: string;
  supplierInvoiceNumber: string | null;
  partnerId: string;
  partnerName: string;
  partnerTaxId: string;
  issueDate: string;
  dueDate: string | null;
  currencyId: string;
  currencyCode: string;
  total: number;
  paid: number;
  creditNotes: number;
  retained: number;
  balance: number;
  status: PayableStatus;
  daysOverdue: number;
};

export type AgingReport = {
  branchId: string;
  asOf: string;
  buckets: Array<{ bucket: AgingBucket; label: string; total: number; invoices: number }>;
  byPartner: Array<{
    partnerId: string;
    partnerName: string;
    partnerTaxId: string;
    total: number;
    overdue: number;
  }>;
  totals: { balance: number; overdue: number };
};

export type SupplierRetentionSettings = {
  companyId: string;
  ivaRetentionRate: number;
  ivaRetentionRateSpecial: number;
  islrRate: number;
  islrSustraendo: number;
  islrThreshold: number;
};

function buildQuery(filters: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const payablesApi = {
  list: (filters: { partnerId?: string; status?: PayableStatus; asOf?: string } = {}) =>
    apiClient.get<Payable[]>(`/billing/invoices/payables${buildQuery(filters)}`),
  aging: (asOf?: string) =>
    apiClient.get<AgingReport>(`/billing/invoices/payables/aging${buildQuery({ asOf })}`),
  getRetentionSettings: () =>
    apiClient.get<SupplierRetentionSettings>('/billing/invoices/supplier-retention-settings'),
  updateRetentionSettings: (data: Partial<Omit<SupplierRetentionSettings, 'companyId'>>) =>
    apiClient.patch<SupplierRetentionSettings>(
      '/billing/invoices/supplier-retention-settings',
      data
    ),
};
