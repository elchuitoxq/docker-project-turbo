import { apiClient } from '@/lib/api/client';

export type RetentionType = 'IVA' | 'ISLR';

export type Retention = {
  id: string;
  type: RetentionType;
  documentCode: string;
  partnerId: string;
  partnerName?: string;
  invoiceId?: string;
  invoiceCode?: string;
  taxAmount: string;
  retentionRate: string;
  retentionAmount: string;
  date: string;
  status: 'DRAFT' | 'APPLIED' | 'PAID' | 'VOID';
};

export const retentionsApi = {
  list: (
    filters: {
      type?: RetentionType;
      status?: string;
      fromDate?: string;
      toDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, String(v));
    const qs = params.toString();
    return apiClient.get<{ data: Retention[]; total: number }>(
      `/accounting/retentions${qs ? `?${qs}` : ''}`
    );
  },
  generateIvaTxt: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to });
    return apiClient.get<{ content: string; filename: string }>(
      `/accounting/retentions/iva/txt?${params}`
    );
  },
  generateIslrXml: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to });
    return apiClient.get<{ content: string; filename: string }>(
      `/accounting/retentions/islr/xml?${params}`
    );
  },
};
