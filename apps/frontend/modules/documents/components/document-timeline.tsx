'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Ban,
  Check,
  CircleDot,
  CreditCard,
  FileCheck2,
  FilePlus2,
  Pencil,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';
import { statusLabel, statusVariant } from '../status';
import type { DocumentEvent } from '../types';

type ActionStyle = { label: string; icon: LucideIcon; tone: 'default' | 'ok' | 'danger' };

const ACTIONS: Record<string, ActionStyle> = {
  ORDER_CREATED: { label: 'Pedido creado', icon: FilePlus2, tone: 'default' },
  ORDER_UPDATED: { label: 'Pedido actualizado', icon: Pencil, tone: 'default' },
  ORDER_CONFIRMED: { label: 'Pedido confirmado', icon: Check, tone: 'ok' },
  ORDER_CANCELLED: { label: 'Pedido cancelado', icon: Ban, tone: 'danger' },
  ORDER_INVOICED: { label: 'Pedido facturado', icon: FileCheck2, tone: 'ok' },
  INVOICE_CREATED: { label: 'Factura creada', icon: FilePlus2, tone: 'default' },
  INVOICE_UPDATED: { label: 'Factura actualizada', icon: Pencil, tone: 'default' },
  INVOICE_POSTED: { label: 'Factura emitida', icon: Check, tone: 'ok' },
  INVOICE_VOIDED: { label: 'Factura anulada', icon: X, tone: 'danger' },
  PAYMENT_REGISTERED: { label: 'Pago registrado', icon: CreditCard, tone: 'ok' },
  PAYMENT_VOIDED: { label: 'Pago anulado', icon: Ban, tone: 'danger' },
};

const TONE_CLASS: Record<ActionStyle['tone'], string> = {
  default: 'bg-muted text-muted-foreground',
  ok: 'bg-primary/10 text-primary',
  danger: 'bg-destructive/10 text-destructive',
};

type Props = {
  events?: DocumentEvent[] | null;
  /** Documento que se está viendo: los eventos del otro se marcan con su origen. */
  currentDocumentId?: string;
  /** Ruta base para enlazar los documentos de la cadena (pedido ↔ factura). */
  links?: { order?: (id: string) => string; invoice?: (id: string) => string };
  className?: string;
};

/**
 * Histórico de procesos de un documento (`S-12`).
 *
 * La línea de tiempo es la cadena completa: si el documento es una factura nacida de un pedido, arriba
 * aparecen los pasos del pedido (marcados con su código) y después los de la factura. Cada paso lleva
 * fecha con hora y el usuario que lo ejecutó, que es lo que faltaba para auditar un documento.
 */
export function DocumentTimeline({ events, currentDocumentId, links, className }: Props) {
  const list = events ?? [];

  return (
    <Card className={className} data-print="hide">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Histórico de procesos</CardTitle>
        <CardDescription>
          {list.length === 0
            ? 'Sin movimientos registrados'
            : `${list.length} movimiento${list.length === 1 ? '' : 's'} · del más antiguo al más reciente`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Este documento no tiene movimientos registrados.
          </p>
        ) : (
          <ol className="flex flex-col">
            {list.map((event, index) => (
              <TimelineItem
                key={event.id}
                event={event}
                last={index === list.length - 1}
                isCurrent={event.documentId === currentDocumentId}
                links={links}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineItem({
  event,
  last,
  isCurrent,
  links,
}: {
  event: DocumentEvent;
  last: boolean;
  isCurrent: boolean;
  links?: Props['links'];
}) {
  const style = ACTIONS[event.action] ?? {
    label: event.action,
    icon: CircleDot,
    tone: 'default' as const,
  };
  const Icon = style.icon;
  // Sólo se enlaza el documento "del otro lado" de la cadena: un enlace al documento abierto no aporta.
  const href = isCurrent
    ? null
    : event.documentType === 'ORDER'
      ? links?.order?.(event.documentId)
      : links?.invoice?.(event.documentId);

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${TONE_CLASS[style.tone]}`}
          aria-hidden
        >
          <Icon className="size-3.5" />
        </span>
        {!last && <span className="my-1 w-px flex-1 bg-border" aria-hidden />}
      </div>

      <div className={last ? 'pb-0' : 'pb-4'}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{style.label}</p>
          {!isCurrent && event.documentCode && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {event.documentType === 'ORDER' ? 'Pedido' : 'Factura'} {event.documentCode}
            </Badge>
          )}
          {event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus && (
            <span className="text-xs text-muted-foreground">
              {statusLabel(event.fromStatus)} →{' '}
              <Badge variant={statusVariant(event.toStatus)} className="text-[10px]">
                {statusLabel(event.toStatus)}
              </Badge>
            </span>
          )}
        </div>

        {event.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
        )}

        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDateTime(event.createdAt)} ·{' '}
          <span className="text-foreground">{event.userName ?? 'Sistema'}</span>
          {href && (
            <>
              {' · '}
              <Link href={href} className="hover:underline">
                Ver {event.documentType === 'ORDER' ? 'pedido' : 'factura'}
              </Link>
            </>
          )}
        </p>
      </div>
    </li>
  );
}
