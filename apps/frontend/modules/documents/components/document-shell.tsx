'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { statusLabel, statusVariant } from '../status';

type Breadcrumb = { label: string; href?: string };

type Props = {
  /** Ruta del listado: es el destino del botón "Volver" y del 404. */
  backHref: string;
  backLabel: string;
  breadcrumb: Breadcrumb[];
  code?: string;
  status?: string | null;
  /** Slot de acciones a la derecha de la cabecera. */
  actions?: React.ReactNode;
  loading?: boolean;
  notFound?: boolean;
  children?: React.ReactNode;
};

/**
 * Marco de la ficha de un documento (`S-10`).
 *
 * Centraliza navegación, estado de carga y el caso "no existe / no corresponde a esta pantalla", para
 * que las cuatro fichas no repitan esa lógica.
 */
export function DocumentShell({
  backHref,
  backLabel,
  breadcrumb,
  code,
  status,
  actions,
  loading,
  notFound,
  children,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Ruta"
        className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
      >
        {breadcrumb.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label={backLabel} data-print="hide">
            <Link href={backHref}>
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {loading ? <Skeleton className="h-7 w-40" /> : (code ?? '—')}
              {!loading && status && (
                <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">{backLabel}</p>
          </div>
        </div>
        {!loading && !notFound && actions && (
          <div className="flex flex-wrap gap-2" data-print="hide">
            {actions}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : notFound ? (
        <DocumentNotFound backHref={backHref} backLabel={backLabel} />
      ) : (
        children
      )}
    </div>
  );
}

/** El documento no existe o pertenece a otra pantalla (mismo criterio que el `404` del backend). */
export function DocumentNotFound({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <FileQuestion className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          El documento no existe, es de otra sucursal o no corresponde a esta pantalla.
        </p>
        <Button asChild variant="outline">
          <Link href={backHref}>Volver a {backLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
