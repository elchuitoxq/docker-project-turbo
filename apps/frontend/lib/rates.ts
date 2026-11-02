import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { BASE_CURRENCY_CODE } from '@/lib/utils';

export { BASE_CURRENCY_CODE };

export type ExchangeRate = {
  id: string;
  rate: number;
  date: string | null;
  source: string;
  currencyCode: string;
};

/** Una tasa con más días que esto se considera vencida y bloquea la emisión hasta confirmarla. */
export const MAX_RATE_AGE_DAYS = 1;

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
 * Convierte un monto entre monedas con tasas "unidades de moneda base por 1 unidad".
 *
 * Devuelve `null` cuando falta alguna tasa: es preferible pedir el precio a mano que inventarlo.
 */
export function convertAmount(
  amount: number,
  fromCode: string,
  toCode: string,
  rateOf: (code: string) => number | null
): number | null {
  if (fromCode === toCode) return amount;

  const from = rateOf(fromCode);
  const to = rateOf(toCode);
  if (!from || !to || from <= 0 || to <= 0) return null;

  return Math.round(((amount * from) / to) * 100) / 100;
}

/**
 * Tasas de un documento: la tasa del documento manda sobre la vigente del sistema, porque el usuario
 * puede haberla escrito o confirmado a mano.
 */
export function documentRateLookup(params: {
  documentCode: string;
  documentRate: number;
  baseCode: string;
  rates?: ExchangeRate[];
}): (code: string) => number | null {
  const { documentCode, documentRate, baseCode, rates } = params;

  return code => {
    if (code === documentCode) return documentRate > 0 ? documentRate : null;
    if (code === baseCode) return 1;

    const rate = findRate(rates, code)?.rate;
    return rate && rate > 0 ? rate : null;
  };
}

/** Moneda de referencia del sistema: contra ella se publica la tasa oficial (S-08). */
export const REFERENCE_CURRENCY_CODE = 'USD';

/** Respuesta de `GET /v1/health/rates`: tasa de la moneda de referencia y su antigüedad. */
export type RateHealth = {
  /** Moneda funcional (VES): vale 1 contra sí misma. */
  baseCurrency: string;
  /** Moneda cuya tasa se informa (USD). */
  referenceCurrency: string | null;
  rate: number | null;
  date: string | null;
  source: string | null;
  ageHours: number | null;
  isStale: boolean;
};

/**
 * Estado de la tasa (`S-08` §5). Lo consume el sidebar para decir **de dónde** viene la tasa y
 * cuántas horas tiene: una tasa cargada a mano no puede anunciarse como "BCV".
 */
export function useRateHealth(options: { enabled?: boolean } = {}) {
  return useQuery<RateHealth>({
    queryKey: ['exchange-rate', 'health'],
    queryFn: () => apiClient.get<RateHealth>('/health/rates'),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/**
 * Tasa de la moneda de referencia (`USD`), que es la que convierte a moneda funcional.
 *
 * La moneda funcional **no tiene tasa**: su fila valdría 1 y no convierte nada.
 */
export function findReferenceRate(rates: ExchangeRate[] | undefined): ExchangeRate | undefined {
  return findRate(rates, REFERENCE_CURRENCY_CODE);
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
