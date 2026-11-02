'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, FileCheck2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useCurrencyIndex } from '@/lib/currency';
import { formatDay } from '@/lib/utils';
import { ordersApi } from '../orders-api';
import { ExchangeRateDialog } from '@/modules/documents/components/exchange-rate-dialog';
import { DocumentShell, DocumentNotFound } from '@/modules/documents/components/document-shell';
import {
  DocumentActions,
  type DocumentAction,
} from '@/modules/documents/components/document-actions';
import { DocumentHeader } from '@/modules/documents/components/document-header';
import { DocumentLines } from '@/modules/documents/components/document-lines';
import { DocumentTotals } from '@/modules/documents/components/document-totals';
import { DocumentTimeline } from '@/modules/documents/components/document-timeline';
import { documentKindLabel } from '@/modules/documents/status';

/**
 * Ficha del pedido (`S-10`, F4).
 *
 * Muestra las líneas con SKU y el total dual con la tasa del pedido, y permite confirmar, cancelar o
 * facturar sin salir de la pantalla. La factura resultante queda enlazada por `invoices.orderId`.
 */
export function OrderDetailView({
  orderId,
  backHref,
  backLabel,
}: {
  orderId: string;
  backHref: string;
  backLabel: string;
}) {
  const { hasPermission } = usePermission();
  const { codeOf } = useCurrencyIndex();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'detail', orderId],
    queryFn: () => ordersApi.getDetail(orderId),
    enabled: Boolean(orderId),
  });

  const invalidate = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
    await queryClient.invalidateQueries({ queryKey: ['invoices'] });
  }, [queryClient]);

  const confirm = useMutation({
    mutationFn: () => ordersApi.confirm(orderId),
    onSuccess: async () => {
      toast.success('Pedido confirmado');
      await invalidate();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo confirmar el pedido'),
  });

  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(orderId),
    onSuccess: async () => {
      toast.success('Pedido cancelado');
      await invalidate();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo cancelar el pedido'),
  });

  const invoice = useMutation({
    mutationFn: () => ordersApi.invoice(orderId),
    onSuccess: async result => {
      toast.success(`Factura ${result.invoiceCode} creada como borrador`);
      await invalidate();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo facturar el pedido'),
  });

  const update = useMutation({
    mutationFn: (payload: Parameters<typeof ordersApi.update>[1]) =>
      ordersApi.update(orderId, payload),
    onSuccess: async () => {
      toast.success('Tasa del pedido actualizada');
      await invalidate();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la tasa'),
  });

  const notFound = !isLoading && !data;
  const currencyCode = data ? (data.currencyCode ?? codeOf(data.currencyId)) : 'VES';
  const exchangeRate = Number(data?.exchangeRate ?? 1) || 1;
  const items = data?.items ?? [];
  const totalBase = items.reduce((sum, item) => sum + item.total, 0);

  const actions: DocumentAction[] = data
    ? [
        {
          id: 'rate',
          label: 'Cambiar tasa',
          icon: <Pencil data-icon="inline-start" />,
          hidden: !hasPermission(PERMISSIONS.OPERATIONS.ORDERS.EDIT),
          disabled: data.status === 'CANCELLED' || data.invoiceStatus === 'POSTED',
          reason:
            data.invoiceStatus === 'POSTED'
              ? 'El pedido ya tiene factura emitida: la tasa quedó congelada'
              : 'Un pedido cancelado no se edita',
          onClick: () => setEditOpen(true),
        },
        {
          id: 'confirm',
          label: 'Confirmar',
          icon: <Check data-icon="inline-start" />,
          variant: 'default',
          hidden: !hasPermission(PERMISSIONS.OPERATIONS.ORDERS.APPROVE),
          disabled: data.status !== 'DRAFT',
          reason: 'Sólo se confirma un pedido en borrador',
          busy: confirm.isPending,
          onClick: () => confirm.mutate(),
        },
        {
          id: 'invoice',
          label: 'Facturar',
          icon: <FileCheck2 data-icon="inline-start" />,
          hidden: !hasPermission(PERMISSIONS.OPERATIONS.ORDERS.APPROVE) || Boolean(data.invoiceId),
          disabled: data.status !== 'CONFIRMED' && data.status !== 'PROCESSING',
          reason: 'Sólo se factura un pedido confirmado',
          busy: invoice.isPending,
          onClick: () => invoice.mutate(),
        },
        {
          id: 'cancel',
          label: 'Cancelar pedido',
          icon: <Ban data-icon="inline-start" />,
          variant: 'destructive',
          hidden: !hasPermission(PERMISSIONS.OPERATIONS.ORDERS.EDIT),
          disabled:
            data.status === 'CANCELLED' || data.status === 'COMPLETED' || Boolean(data.invoiceId),
          reason: data.invoiceId
            ? 'Un pedido facturado no se cancela: anula la factura'
            : 'El pedido ya está cerrado',
          busy: cancel.isPending,
          onClick: () => cancel.mutate(),
        },
        {
          id: 'print',
          label: 'Imprimir',
          onClick: () => window.print(),
        },
      ]
    : [];

  return (
    <DocumentShell
      backHref={backHref}
      backLabel={backLabel}
      breadcrumb={[
        { label: 'Panel', href: '/dashboard' },
        { label: backLabel, href: backHref },
        { label: data?.code ?? 'Pedido' },
      ]}
      code={data?.code}
      status={data?.status}
      loading={isLoading}
      notFound={notFound}
      actions={<DocumentActions actions={actions} />}
    >
      {!data ? (
        <DocumentNotFound backHref={backHref} backLabel={backLabel} />
      ) : (
        <div className="flex flex-col gap-3">
          <DocumentHeader
            title={data.partnerName ?? '—'}
            subtitle={`Pedido de ${documentKindLabel(data.type).toLowerCase()}`}
            meta={[
              { label: 'Fecha', value: data.date ? formatDay(data.date.slice(0, 10)) : '—' },
              { label: 'Moneda', value: currencyCode },
              { label: 'Tasa', value: exchangeRate.toFixed(2) },
              { label: 'Sucursal', value: data.branchName ?? '—' },
              { label: 'Almacén', value: data.warehouseName ?? '—' },
              { label: 'RIF', value: data.partnerTaxId ?? '—' },
              { label: 'Registró', value: data.createdByName ?? '—' },
            ]}
          />

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DocumentLines items={items} currencyCode={currencyCode} />
            </div>
            <DocumentTotals
              totalBase={totalBase}
              totalTax={0}
              totalIgtf={0}
              total={data.total}
              currencyCode={currencyCode}
              exchangeRate={exchangeRate}
              issueLabel="Total del pedido"
              // Un pedido no es un documento fiscal: el total va sólo en su moneda.
              showBaseEquivalent={false}
            />
          </div>

          {data.invoiceId && data.invoiceCode && (
            <div className="rounded-md border p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Factura generada
              </p>
              <Link
                href={`/dashboard/finance/invoices/${data.invoiceId}`}
                className="font-mono hover:underline"
              >
                {data.invoiceCode}
              </Link>
            </div>
          )}

          <DocumentTimeline
            events={data.history}
            currentDocumentId={data.id}
            links={{ invoice: id => `/dashboard/finance/invoices/${id}` }}
          />
        </div>
      )}
      {editOpen && data && (
        <ExchangeRateDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          documentLabel={`el pedido ${data.code}`}
          currencyCode={currencyCode}
          currentRate={exchangeRate}
          items={items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          }))}
          onSubmit={async payload => {
            await update.mutateAsync(payload);
          }}
        />
      )}
    </DocumentShell>
  );
}
