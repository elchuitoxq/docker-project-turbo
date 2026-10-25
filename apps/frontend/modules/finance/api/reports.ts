import { apiClient } from '@/lib/api/client';

export const reportsApi = {
  balanceSheet: (date: string) => apiClient.get<Record<string, unknown>>(`/reports/balance-sheet?date=${date}`),
  incomeStatement: (from: string, to: string) =>
    apiClient.get<Record<string, unknown>>(`/reports/income-statement?from=${from}&to=${to}`),
  ivaBook: (from: string, to: string, type: 'SALES' | 'PURCHASES' = 'SALES') =>
    apiClient.get<{ rows: Array<{ date: string; code: string; partner: string; base: number; tax: number }> }>(
      `/reports/iva-book?from=${from}&to=${to}&type=${type}`,
    ),
  islrBook: (from: string, to: string) =>
    apiClient.get<{ rows: Array<{ date: string; code: string; partner: string; base: number; retention: number }> }>(
      `/reports/islr-book?from=${from}&to=${to}`,
    ),
};
