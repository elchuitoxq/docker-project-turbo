import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export type ExchangeRate = {
  id: string;
  rate: number;
  date: string | null;
  source: string;
  currencyCode: string;
};

/** Una tasa con más días que esto se considera vencida y bloquea la emisión hasta confirmarla. */
export const MAX_RATE_AGE_DAYS = 1;

/** Moneda funcional del sistema (decisión D-01 de `S-08`): la tasa que convierte es la suya. */
export const BASE_CURRENCY_CODE = 'VES';

/**
 * Tasas vigentes por moneda (`T-08-12`).
 *
 * Una sola clave de caché para toda la aplicación: el sidebar, el diálogo de pago y cualquier
 * formulario de emisión muestran la misma tasa y la misma antigüedad.
 */
export function useLatestRates(options: { enabled?: boolean } = {}) {
  return useQuery<ExchangeRate[]>({
    queryKey: ['exchange-rate', 'current'],
    queryFn: () => apiClient.get<ExchangeRate[]>('/settings/currencies/rates/latest'),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function findRate(
  rates: ExchangeRate[] | undefined,
  currencyCode: string | null | undefined
): ExchangeRate | undefined {
  if (!rates || !currencyCode) return undefined;
  return rates.find(rate => rate.currencyCode === currencyCode);
}

/**
 * Tasa que convierte a moneda funcional (`base = monto × rate`).
 *
 * Es la de la moneda funcional, no la del documento: la fila `USD = 1` no convierte nada.
 */
export function findBaseRate(rates: ExchangeRate[] | undefined): ExchangeRate | undefined {
  return findRate(rates, BASE_CURRENCY_CODE);
}

/** Días completos entre la fecha de la tasa y `today`; `null` si la tasa no trae fecha. */
export function rateAgeInDays(
  date: string | null | undefined,
  today: Date = new Date()
): number | null {
  if (!date) return null;

  const isoDate = date.slice(0, 10);
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return null;

  const rateDay = Date.UTC(year, month - 1, day);
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.round((todayDay - rateDay) / 86_400_000);
}

/**
 * `true` cuando la tasa no sirve para emitir sin confirmación: sin fecha, con fecha futura
 * (reloj o carga manual) o más vieja que `maxAgeDays`.
 */
export function isRateStale(
  date: string | null | undefined,
  maxAgeDays: number = MAX_RATE_AGE_DAYS,
  today: Date = new Date()
): boolean {
  const age = rateAgeInDays(date, today);
  if (age === null) return true;
  return age < 0 || age > maxAgeDays;
}
