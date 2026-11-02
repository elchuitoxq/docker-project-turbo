import { apiClient } from '@/lib/api/client';
import type { Currency } from '@/lib/currency';

export type LatestRate = {
  id: string;
  currencyId: string;
  rate: number;
  date: string | null;
  source: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
};

export type RateHistoryEntry = {
  id: string;
  currencyCode: string;
  rate: number;
  date: string;
  source: string;
  reason: string | null;
  createdBy: string | null;
};

export type AddRatePayload = {
  currencyCode: string;
  rate: number;
  /** Obligatorio: un override sin motivo no es auditable (`S-08` M9). */
  reason: string;
  date?: string;
};

export type CreateCurrencyPayload = {
  code: string;
  name: string;
  symbol: string;
};

export const currenciesApi = {
  list: () => apiClient.get<Currency[]>('/settings/currencies'),
  listLatestRates: () => apiClient.get<LatestRate[]>('/settings/currencies/rates/latest'),
  history: (currencyCode: string, limit = 20) =>
    apiClient.get<RateHistoryEntry[]>(
      `/settings/currencies/rates/${currencyCode}/history?limit=${limit}`
    ),
  addRate: (payload: AddRatePayload) =>
    apiClient.post<RateHistoryEntry>('/settings/currencies/rates', {
      ...payload,
      source: 'MANUAL',
    }),
  refresh: () =>
    apiClient.post<{
      status: 'stored' | 'unchanged' | 'manual-override';
      rate: number;
      date: string;
      source: string;
    }>('/settings/currencies/refresh', {}),
  create: (payload: CreateCurrencyPayload) =>
    apiClient.post<Currency>('/settings/currencies', payload),
};
