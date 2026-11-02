import { apiClient } from '@/lib/api/client';

export type RetentionType = 'IVA' | 'ISLR';

/** Comprobante de retención tal como lo devuelve `GET /v1/treasury/retentions`. */
export type Retention = {
  id: string;
  code: string;
  voucherNumber: string | null;
  type: RetentionType;
  partnerId: string;
  partnerName: string | null;
  invoiceId: string | null;
  invoiceCode: string | null;
  period: string;
  date: string;
  /** Base imponible en la moneda del comprobante. */
  totalBase: number;
  /** IVA de la factura. */
  totalTax: number;
  /** Monto retenido en la moneda del comprobante. */
  totalRetained: number;
  /** Monto retenido en moneda funcional (VES). */
  totalRetainedBase: number;
  currencyId: string | null;
};

export const retentionsApi = {
  list: (
    filters: {
      type?: RetentionType;
      from?: string;
      to?: string;
      partnerId?: string;
    } = {}
  ) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, String(v));
    const qs = params.toString();
    return apiClient.get<Retention[]>(`/treasury/retentions${qs ? `?${qs}` : ''}`);
  },
  generateIvaTxt: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to });
    return apiClient.get<{ content: string; filename: string }>(
      `/reports/fiscal/retenciones-txt?${params}`
    );
  },
  generateIslrXml: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to });
    return apiClient.get<{ content: string; filename: string }>(
      `/reports/fiscal/retenciones-xml?${params}`
    );
  },
};
