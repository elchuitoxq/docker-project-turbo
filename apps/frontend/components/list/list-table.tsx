'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Primitivos de listado (`S-11`).
 *
 * Las pantallas de maestros y documentos tenían siete estilos de tabla distintos: unas dentro de
 * `Card`, otras en un `div` con borde, con cargas y vacíos diferentes. Estas piezas fijan un único
 * patrón —tarjeta con cabecera, tabla estándar, esqueleto y vacío homogéneos— sin atar la vista a los
 * datos.
 */

export type ListAlign = 'left' | 'right';
export type HideBelow = 'sm' | 'md' | 'lg';

const HIDE_CLASS: Record<HideBelow, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

/** Tarjeta de listado: cabecera con título, conteo y acciones, y la tabla sin padding extra. */
export function ListCard({
  title,
  description,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

/**
 * Barra de filtros del listado: misma tarjeta y rejilla que el resto de pantallas.
 *
 * Va fuera del `ListCard` para que la tabla conserve una única fila de cabecera y los filtros no se
 * mezclen con el título del listado.
 */
export function ListFilters({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>
      </CardContent>
    </Card>
  );
}

/** Encabezado de columna: alineación y visibilidad responsive declarativas. */
export function ListTh({
  align = 'left',
  hide,
  className,
  children,
}: {
  align?: ListAlign;
  hide?: HideBelow;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <TableHead
      className={cn(align === 'right' && 'text-right', hide && HIDE_CLASS[hide], className)}
    >
      {children}
    </TableHead>
  );
}

/** Celda: `numeric` alinea a la derecha con cifras tabulares, `mono` para códigos. */
export function ListTd({
  align = 'left',
  hide,
  numeric,
  mono,
  muted,
  className,
  children,
}: {
  align?: ListAlign;
  hide?: HideBelow;
  numeric?: boolean;
  mono?: boolean;
  muted?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <TableCell
      className={cn(
        'h-[52px]',
        (align === 'right' || numeric) && 'text-right',
        numeric && 'tabular-nums',
        mono && 'font-mono text-xs',
        muted && 'text-muted-foreground',
        hide && HIDE_CLASS[hide],
        className
      )}
    >
      {children}
    </TableCell>
  );
}

/** Filas de carga homogéneas: mantienen visible el encabezado de la tabla. */
export function ListSkeletonRows({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRow key={index}>
          <TableCell colSpan={cols} className="h-[52px]">
            <Skeleton className="h-5 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/** Estado vacío dentro de la tabla: el encabezado sigue visible para orientar al usuario. */
export function ListEmptyRow({
  cols,
  message,
  hint,
}: {
  cols: number;
  message: string;
  hint?: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">
        {message}
        {hint && <span className="mt-1 block text-xs">{hint}</span>}
      </TableCell>
    </TableRow>
  );
}

/** Acciones de fila: mismo disparador (menú de tres puntos) en todas las tablas. */
export function ListRowActions({
  children,
  label = 'Acciones',
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export { Table, TableBody, TableHeader, TableRow };
