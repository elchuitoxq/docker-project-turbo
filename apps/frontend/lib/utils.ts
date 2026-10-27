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
