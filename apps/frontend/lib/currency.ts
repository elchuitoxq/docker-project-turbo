import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { BASE_CURRENCY_CODE } from '@/lib/utils';

export type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
};

/**
 * Catálogo de monedas (`GET /v1/settings/currencies`).
 *
 * Se usa para traducir el `currencyId` que devuelven los documentos al código con el que se
 * formatea el monto: sin esto la UI no puede saber si un total es USD o VES (`T-09-01`).
 */
export function useCurrencies(options: { enabled?: boolean } = {}) {
  return useQuery<Currency[]>({
    queryKey: ['currencies', 'catalog'],
    queryFn: () => apiClient.get<Currency[]>('/settings/currencies'),
    enabled: options.enabled ?? true,
    staleTime: 30 * 60_000,
  });
}

export type CurrencyIndex = {
  /** Código de la moneda funcional: el de los agregados y el de la columna paralela. */
  baseCode: string;
  byId: ReadonlyMap<string, Currency>;
  /** Código de una moneda por id; si no se conoce cae a la funcional, nunca a USD. */
  codeOf: (currencyId?: string | null) => string;
  symbolOf: (currencyId?: string | null) => string;
};

export function buildCurrencyIndex(currencies: Currency[] | undefined): CurrencyIndex {
  const byId = new Map((currencies ?? []).map(currency => [currency.id, currency]));
  const base = currencies?.find(currency => currency.isBase);

  return {
    baseCode: base?.code ?? BASE_CURRENCY_CODE,
    byId,
    codeOf: currencyId =>
      (currencyId ? byId.get(currencyId)?.code : undefined) ?? base?.code ?? BASE_CURRENCY_CODE,
    symbolOf: currencyId =>
      (currencyId ? byId.get(currencyId)?.symbol : undefined) ?? base?.symbol ?? BASE_CURRENCY_CODE,
  };
}

export function useCurrencyIndex(): CurrencyIndex {
  const { data } = useCurrencies();
  return useMemo(() => buildCurrencyIndex(data), [data]);
}
