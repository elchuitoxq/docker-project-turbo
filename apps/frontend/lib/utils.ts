import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Moneda funcional del sistema (decisión D-01 de `S-08`). */
export const BASE_CURRENCY_CODE = 'VES';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un monto en su moneda.
 *
 * El código es **obligatorio** a propósito: con un valor por defecto toda la app pintaba los montos
 * en USD aunque el documento estuviera en VES (`T-09-01` de `S-09`).
 */
export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Monto en las dos monedas (`T-08-12`): el documento manda y su equivalente en moneda funcional se
 * calcula con la tasa **del documento**.
 *
 * La moneda funcional no se duplica: si el documento ya está en base, el monto es el mismo y repetirlo
 * como "equivalente" haría creer que se convirtió algo. Con una tasa inválida se muestra sólo el monto
 * original: es preferible un importe a un `Infinity`.
 */
export function formatDual(amount: number, currency: string, rate: number) {
  const primary = formatMoney(amount, currency);
  if (currency === BASE_CURRENCY_CODE) return primary;
  if (!Number.isFinite(rate) || rate <= 0) return primary;

  return `${primary} · ${formatMoney(amount * rate, BASE_CURRENCY_CODE)}`;
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

/**
 * Fecha y hora local (`30/10/2026, 14:32`).
 *
 * La usa el histórico de procesos: ahí el orden de los pasos importa, así que dos acciones del mismo
 * día no pueden verse iguales. Una fecha inválida se muestra tal cual llegó en vez de "Invalid Date".
 */
export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return '—';

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '—';

  return new Intl.DateTimeFormat('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
