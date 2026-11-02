'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Valor del control: `YYYY-MM-DD` (el mismo formato que enviaba `<input type="date">`). */
export type DatePickerValue = string | null | undefined;

type Props = {
  id?: string;
  /** `YYYY-MM-DD`. Es lo que viaja al API y a los filtros de los reportes. */
  value?: DatePickerValue;
  /** Modo no controlado (formularios con `FormData`): el control guarda su propia fecha. */
  defaultValue?: DatePickerValue;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Nombre para los formularios que se envían con `FormData` (nómina, asientos, empleados). */
  name?: string;
  required?: boolean;
  'aria-invalid'?: boolean;
  /** Permite dejar el campo vacío; si no, el botón de limpiar no se muestra. */
  clearable?: boolean;
  /** Fecha mínima seleccionable (p. ej. el "desde" de un rango). */
  fromDate?: DatePickerValue;
  /** Fecha máxima seleccionable (p. ej. el "hasta" de un rango). */
  toDate?: DatePickerValue;
  align?: 'start' | 'center' | 'end';
  'aria-label'?: string;
};

/**
 * Control de fecha único sobre `Popover` + `Calendar` (`S-13`).
 *
 * Sustituye a los `<input type="date">`, cuyo aspecto y comportamiento dependen del navegador (en
 * Chromium el texto va en `dd-mm-aaaa`, sin selector y con un icono que no sigue el tema). Mantiene el
 * valor como `YYYY-MM-DD` para no tocar los contratos existentes, y cuando recibe `name` deja un
 * `<input type="hidden">` para los formularios que leen `FormData`.
 *
 * Las fechas se construyen en horario local: `new Date('2026-10-27')` es medianoche UTC y en Venezuela
 * se mostraría el día anterior.
 */
export function DatePicker({
  id,
  value,
  defaultValue,
  onChange,
  placeholder = 'Seleccionar fecha',
  disabled,
  className,
  name,
  required,
  'aria-invalid': ariaInvalid,
  clearable,
  fromDate,
  toDate,
  align = 'start',
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = React.useState(false);
  // Sin `value` el control es no controlado: así sirve dentro de un `<form>` que lee `FormData`.
  const [internalValue, setInternalValue] = React.useState<string>(defaultValue ?? '');
  const current = value !== undefined ? value : internalValue;

  const selected = parseDay(current);
  const min = parseDay(fromDate);
  const max = parseDay(toDate);

  const handleSelect = (date: Date | undefined) => {
    const next = date ? toDayValue(date) : '';

    if (value === undefined) setInternalValue(next);
    onChange?.(next);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            data-empty={!selected}
            aria-invalid={ariaInvalid}
            aria-required={required}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              'w-full justify-start font-normal data-[empty=true]:text-muted-foreground',
              className
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            <span className="truncate">
              {selected ? format(selected, 'dd/MM/yyyy') : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <Calendar
            mode="single"
            locale={es}
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected ?? min}
            disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
          />
          {clearable && selected && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleSelect(undefined)}
              >
                <X data-icon="inline-start" />
                Limpiar
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {name && (
        <input type="hidden" name={name} value={selected ? toDayValue(selected) : ''} readOnly />
      )}
    </>
  );
}

/** `YYYY-MM-DD` → `Date` en horario local; `undefined` si viene vacío o mal formado. */
export function parseDay(value: DatePickerValue): Date | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return undefined;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** `Date` → `YYYY-MM-DD` sin pasar por UTC. */
export function toDayValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
