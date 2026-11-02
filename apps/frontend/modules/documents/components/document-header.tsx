'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDay } from '@/lib/utils';

type Meta = { label: string; value: React.ReactNode };

/**
 * Cabecera de datos del documento: tercero, contexto y trazabilidad (`S-10`).
 *
 * Todos los montos se formatean con la moneda del documento; aquí sólo hay datos descriptivos.
 */
export function DocumentHeader({
  title,
  subtitle,
  meta,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta: Meta[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tercero</p>
          <p className="text-lg font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {meta
            .filter(item => item.value !== null && item.value !== undefined && item.value !== '')
            .map(item => (
              <div key={item.label}>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="font-medium">{item.value}</dd>
              </div>
            ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** Fecha con guion largo cuando el documento no la tiene. */
export function DocumentDate({ value }: { value?: string | null }) {
  return <>{value ? formatDay(value.slice(0, 10)) : '—'}</>;
}
