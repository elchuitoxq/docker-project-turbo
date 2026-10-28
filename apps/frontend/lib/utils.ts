import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: 'USD' | 'VES' = 'USD') {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Monto en las dos monedas (`T-08-12`): el documento manda y la otra moneda se calcula con la tasa.
 *
 * Con una tasa inválida devuelve sólo el monto original: es preferible un importe a un `Infinity`.
 */
export function formatDual(amount: number, currency: 'USD' | 'VES', rate: number) {
  const primary = formatCurrency(amount, currency);
  if (!Number.isFinite(rate) || rate <= 0) return primary;

  const secondary =
    currency === 'USD'
      ? formatCurrency(amount * rate, 'VES')
      : formatCurrency(amount / rate, 'USD');

  return `${primary} · ${secondary}`;
}

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Fecha sin hora (`YYYY-MM-DD`), tal como la devuelven los reportes de saldos.
 *
 * `new Date('2026-10-27')` es medianoche UTC: en Venezuela se mostraría el día anterior. Aquí el día
 * se toma literal y se construye en horario local.
 */
export function formatDay(value: string | null | undefined) {
  if (!value) return '—';

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(year, month - 1, day));
}
