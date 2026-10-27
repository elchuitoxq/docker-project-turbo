import { apiClient } from '@/lib/api/client';

/**
 * Reportes fiscales (`S-06`). Antes este cliente llamaba a `/reports/iva-book` y `/reports/islr-book`,
 * rutas que nunca existieron: la pantalla fallaba sin decirlo. Ahora apunta a los endpoints reales.
 */

export type RateBucket = { rate: number; base: number; tax: number };

export type FiscalBookRow = {
  date: string;
  code: string;
  controlNumber: string | null;
  partnerTaxId: string;
  partnerName: string;
  documentType: 'INVOICE' | 'CREDIT_NOTE';
  total: number;
  exempt: number;
  base: number;
  tax: number;
  rate: number | null;
};

export type FiscalBook = {
  type: 'SALES' | 'PURCHASES';
  branchId: string;
  from: string | null;
  to: string | null;
  rows: FiscalBookRow[];
  totals: {
    documents: number;
    total: number;
    exempt: number;
    base: number;
    tax: number;
    byRate: RateBucket[];
  };
  consistent: boolean;
};

export type FiscalFinding = {
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
};

export type FiscalValidation = {
  branchId: string;
  from: string | null;
  to: string | null;
  findings: FiscalFinding[];
  errors: number;
  warnings: number;
  canExport: boolean;
};

export type FiscalExport = {
  id: string;
  code: string;
  reportType: string;
  format: string;
  sequenceNumber: number;
  hash: string;
  sizeBytes: number;
  generatedAt: string;
  content: string;
  warnings: string[];
};

export type FiscalSummary = {
  totalInvoices: number;
  totalCreditNotes: number;
  totalBaseImponible: number;
  totalIva: number;
  totalIgtf: number;
  totalRetencionesIva: number;
  totalRetencionesIslr: number;
};

function query(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const reportsApi = {
  salesBook: (from?: string, to?: string) =>
    apiClient.get<FiscalBook>(`/reports/fiscal/libro-ventas${query({ from, to })}`),
  purchaseBook: (from?: string, to?: string) =>
    apiClient.get<FiscalBook>(`/reports/fiscal/libro-compras${query({ from, to })}`),
  validation: (from?: string, to?: string) =>
    apiClient.get<FiscalValidation>(`/reports/fiscal/validation${query({ from, to })}`),
  summary: (from?: string, to?: string) =>
    apiClient.get<FiscalSummary>(`/reports/fiscal/summary${query({ dateFrom: from, dateTo: to })}`),
  exportReport: (body: {
    reportType: 'LIBRO_VENTAS' | 'LIBRO_COMPRAS' | 'RETENCIONES_IVA' | 'RETENCIONES_ISLR';
    format: 'CSV' | 'TXT' | 'XML';
    from?: string;
    to?: string;
  }) => apiClient.post<FiscalExport>('/reports/fiscal/exports', body),
};
