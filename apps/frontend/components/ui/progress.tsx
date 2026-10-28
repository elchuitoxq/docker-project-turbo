'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Barra de progreso simple (sin dependencia nueva): el proyecto ya tiene `Separator`, `Badge` y las
 * tarjetas; una barra de dos `div` no justifica traer otro paquete de UI.
 */
export function Progress({
  value = 0,
  className,
  ...props
}: React.ComponentProps<'div'> & { value?: number }) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-transform"
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </div>
  );
}
