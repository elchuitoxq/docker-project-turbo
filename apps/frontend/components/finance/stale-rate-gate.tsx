'use client';

import { AlertTriangle, CalendarClock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatDay } from '@/lib/utils';
import { rateAgeInDays, isRateStale, type ExchangeRate } from '@/lib/rates';

type Props = {
  rate: ExchangeRate | undefined;
  currencyCode: string;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  /** Qué se emite, para que el aviso diga qué está bloqueado. */
  documentLabel: string;
};

/**
 * Aviso de tasa vencida (`T-08-12`).
 *
 * Si la tasa del día no está disponible o tiene más de un día, emitir con ella es una decisión
 * consciente: el formulario queda bloqueado hasta que el usuario confirma la fecha que va a usar.
 */
export function StaleRateGate({
  rate,
  currencyCode,
  confirmed,
  onConfirmedChange,
  documentLabel,
}: Props) {
  const age = rateAgeInDays(rate?.date);
  const stale = !rate || isRateStale(rate.date);

  if (!stale) return null;

  const reason = !rate
    ? `No hay tasa vigente para ${currencyCode}.`
    : `La tasa de ${currencyCode} es del ${rate.date ? formatDay(rate.date) : 'una fecha desconocida'}${
        age !== null && age > 0 ? ` (hace ${age} ${age === 1 ? 'día' : 'días'})` : ''
      }.`;

  return (
    <Alert variant="destructive" data-testid="stale-rate-gate">
      <AlertTriangle />
      <AlertTitle>Tasa desactualizada</AlertTitle>
      <AlertDescription>
        <p>
          {reason} Registrar {documentLabel} con una tasa vieja cambia el monto en moneda funcional.
        </p>
        <Label className="mt-1 flex items-start gap-2 font-normal">
          <Checkbox
            checked={confirmed}
            onCheckedChange={value => onConfirmedChange(value === true)}
            aria-label="Confirmar tasa vencida"
          />
          <span className="text-xs leading-snug">
            Confirmo usar {rate ? `la tasa ${rate.rate.toFixed(2)}` : 'la tasa disponible'} y asumo
            la diferencia.
          </span>
        </Label>
      </AlertDescription>
    </Alert>
  );
}

/** Marca compacta para el encabezado: dice la fecha de la tasa y alerta si está vencida. */
export function RateAgeBadge({ rate }: { rate: ExchangeRate | undefined }) {
  if (!rate) return null;
  const stale = isRateStale(rate.date);

  return (
    <span
      className={
        stale
          ? 'flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400'
          : 'flex items-center gap-1 text-[10px] text-muted-foreground'
      }
      title={
        rate.date ? `Tasa del ${formatDay(rate.date)} · ${rate.source}` : `Tasa ${rate.source}`
      }
      data-testid="rate-age"
    >
      <CalendarClock className="size-3" />
      {rate.date ? formatDay(rate.date) : 'sin fecha'}
    </span>
  );
}
