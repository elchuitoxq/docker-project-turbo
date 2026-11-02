'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, FileJson, Pencil, Printer, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useCurrencyIndex } from '@/lib/currency';
import { formatDay } from '@/lib/utils';
import {
  useInvoiceDetail,
  usePostInvoice,
  useUpdateInvoice,
  useVoidInvoice,
} from '../hooks/use-invoices';
import { invoicesApi } from '../api/invoices';
import { PaymentDialog } from './payment-dialog';
import { ExchangeRateDialog } from '@/modules/documents/components/exchange-rate-dialog';
import { DocumentShell, DocumentNotFound } from '@/modules/documents/components/document-shell';
import {
  DocumentActions,
  type DocumentAction,
} from '@/modules/documents/components/document-actions';
import { DocumentHeader } from '@/modules/documents/components/document-header';
import { DocumentLines } from '@/modules/documents/components/document-lines';
import { DocumentTotals } from '@/modules/documents/components/document-totals';
import { DocumentRelated } from '@/modules/documents/components/document-related';
import { DocumentTimeline } from '@/modules/documents/components/document-timeline';
import { documentKindLabel } from '@/modules/documents/status';

type Props = {
  invoiceId: string;
  backHref: string;
  backLabel: string;
  /**
   * Tipo exigido por la ruta: `/sales/:id` sólo abre ventas y `/purchases/:id` sólo compras. Una
   * factura del otro tipo se trata como inexistente, igual que un recurso de otra sucursal.
   */
  expectedType?: 'SALE' | 'PURCHASE';
  /** Ficha de compra: muestra el número de factura del proveedor y sus retenciones. */
  showSupplier?: boolean;
};

/**
 * Ficha de factura de venta o compra (`S-10`).
 *
 * Muestra lo que el backend devolvió: moneda y tasa **congeladas** en el documento, total dual y saldo
 * calculado por el backend (`settlement`). La UI no recalcula importes.
 */
export function InvoiceDetailView({
  invoiceId,
  backHref,
  backLabel,
  expectedType,
  showSupplier,
}: Props) {
  const { hasPermission } = usePermission();
  const { codeOf } = useCurrencyIndex();
  const { data, isLoading } = useInvoiceDetail(invoiceId);
  const post = usePostInvoice();
  const voidInvoice = useVoidInvoice();
  const update = useUpdateInvoice(invoiceId);

  const [voidOpen, setVoidOpen] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState('');
  const [fiscalOpen, setFiscalOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  // El JSON fiscal sólo existe para documentos emitidos; se pide al abrir el diálogo (T-10-15).
  const fiscal = useQuery({
    queryKey: ['invoices', 'fiscal', invoiceId],
    queryFn: () => invoicesApi.getFiscalJson(invoiceId),
    enabled: fiscalOpen,
  });

  const wrongType = Boolean(data && expectedType && data.type !== expectedType);
  const notFound = !isLoading && (!data || wrongType);

  const currencyCode = data ? (data.currencyCode ?? codeOf(data.currencyId)) : 'VES';
  const exchangeRate = Number(data?.exchangeRate ?? 1) || 1;
  const balance = Number(data?.settlement?.balance ?? data?.total ?? 0);
  const kind = documentKindLabel(data?.type);

  const actions: DocumentAction[] = data
    ? [
        {
          id: 'rate',
          label: 'Cambiar tasa',
          icon: <Pencil data-icon="inline-start" />,
          hidden: !hasPermission(PERMISSIONS.FINANCE.INVOICES.EDIT),
          disabled: data.status !== 'DRAFT',
          reason: 'Sólo se edita un borrador; al emitir la tasa queda congelada',
          onClick: () => setEditOpen(true),
        },
        {
          id: 'post',
          label: 'Postear',
          icon: <Check data-icon="inline-start" />,
          variant: 'default',
          hidden: !hasPermission(PERMISSIONS.FINANCE.INVOICES.POST),
          disabled: data.status !== 'DRAFT',
          reason: 'Sólo se postea un borrador',
          busy: post.isPending,
          onClick: () =>
            post.mutate(data.id, {
              onSuccess: () => toast.success('Factura emitida'),
              onError: error =>
                toast.error(error instanceof Error ? error.message : 'No se pudo emitir'),
            }),
        },
        {
          id: 'void',
          label: 'Anular',
          icon: <X data-icon="inline-start" />,
          variant: 'destructive',
          hidden: !hasPermission(PERMISSIONS.FINANCE.INVOICES.VOID),
          disabled: data.status !== 'POSTED',
          reason: 'Sólo se anula una factura emitida',
          busy: voidInvoice.isPending,
          onClick: () => {
            setVoidReason('');
            setVoidOpen(true);
          },
        },
        {
          id: 'pay',
          label: data.type === 'PURCHASE' ? 'Registrar pago' : 'Registrar cobro',
          icon: <Wallet data-icon="inline-start" />,
          variant: 'default',
          hidden: !hasPermission(PERMISSIONS.FINANCE.PAYMENTS.CREATE),
          disabled: !(data.status === 'POSTED' || data.status === 'PARTIAL') || balance <= 0,
          reason:
            balance <= 0
              ? 'La factura no tiene saldo pendiente'
              : 'Sólo se cobra una factura emitida',
          onClick: () => setPayOpen(true),
        },
        {
          id: 'fiscal',
          label: 'JSON fiscal',
          icon: <FileJson data-icon="inline-start" />,
          hidden: data.status !== 'POSTED',
          onClick: () => setFiscalOpen(true),
        },
        {
          id: 'print',
          label: 'Imprimir',
          icon: <Printer data-icon="inline-start" />,
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
        { label: data?.code ?? 'Factura' },
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
            subtitle={`Factura de ${kind.toLowerCase()}`}
            meta={[
              { label: 'Emisión', value: data.date ? formatDay(data.date.slice(0, 10)) : '—' },
              {
                label: 'Vence',
                value: data.dueDate ? formatDay(data.dueDate.slice(0, 10)) : '—',
              },
              ...(data.daysOverdue && data.daysOverdue > 0
                ? [{ label: 'Vencida', value: `${data.daysOverdue} días` }]
                : []),
              { label: 'Moneda', value: currencyCode },
              { label: 'Tasa', value: exchangeRate.toFixed(2) },
              { label: 'Sucursal', value: data.branchName ?? '—' },
              { label: 'Almacén', value: data.warehouseName ?? '—' },
              { label: 'Folio fiscal', value: data.invoiceNumber ?? '—' },
              ...(showSupplier
                ? [
                    {
                      label: 'Factura del proveedor',
                      value: data.supplierInvoiceNumber ?? '—',
                    },
                  ]
                : []),
              { label: 'Registró', value: data.createdByName ?? '—' },
            ]}
          />

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DocumentLines items={data.items ?? []} currencyCode={currencyCode} />
            </div>
            <DocumentTotals
              totalBase={data.totalBase}
              totalTax={data.totalTax}
              totalIgtf={data.totalIgtf}
              total={data.total}
              currencyCode={currencyCode}
              exchangeRate={exchangeRate}
              settlement={data.settlement}
              // El total se muestra sólo en la moneda del documento: el equivalente en moneda
              // funcional depende de la tasa y distorsiona el importe facturado.
              showBaseEquivalent={false}
            />
          </div>

          <DocumentRelated
            orderHref={data.orderId ? `/dashboard/operations/orders/${data.orderId}` : null}
            orderCode={data.orderCode}
            payments={data.payments}
            creditNotes={data.creditNotes}
            retentions={data.retentions}
            currencyCode={currencyCode}
          />

          <DocumentTimeline
            events={data.history}
            currentDocumentId={data.id}
            links={{ order: id => `/dashboard/operations/orders/${id}` }}
          />

          <p className="text-xs text-muted-foreground">
            La tasa del documento ({exchangeRate.toFixed(2)}) queda congelada al emitir:{' '}
            <Link href="/dashboard/settings/currencies" className="hover:underline">
              ver tasas vigentes
            </Link>
            .
          </p>
        </div>
      )}

      {editOpen && data && (
        <ExchangeRateDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          documentLabel={`la factura ${data.code}`}
          currencyCode={currencyCode}
          currentRate={exchangeRate}
          items={(data.items ?? []).map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          }))}
          onSubmit={async payload => {
            await update.mutateAsync(payload);
            toast.success('Tasa actualizada');
          }}
        />
      )}

      {payOpen && data && (
        <PaymentDialog
          invoiceId={data.id}
          code={data.code}
          partnerId={data.partnerId}
          partnerName={data.partnerName}
          balance={balance}
          currencyId={data.currencyId}
          currencyCode={currencyCode}
          invoiceRate={exchangeRate}
          direction={data.type === 'PURCHASE' ? 'EXPENSE' : 'INCOME'}
          onClose={() => setPayOpen(false)}
          onDone={() => setPayOpen(false)}
        />
      )}

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular {data?.code}</DialogTitle>
            <DialogDescription>
              La anulación no se puede deshacer y queda registrada en auditoría.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="void-reason">Motivo *</FieldLabel>
              <textarea
                id="void-reason"
                value={voidReason}
                onChange={event => setVoidReason(event.target.value)}
                required
                className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Describe el motivo de la anulación…"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={voidReason.trim().length < 3 || voidInvoice.isPending}
              onClick={async () => {
                if (!data) return;
                await voidInvoice.mutateAsync({ id: data.id, reason: voidReason });
                toast.success('Factura anulada');
                setVoidOpen(false);
              }}
            >
              Confirmar anulación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={fiscalOpen} onOpenChange={setFiscalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>JSON fiscal de {data?.code}</DialogTitle>
            <DialogDescription>
              Documento para el SENIAT tal como lo emitió el sistema.
            </DialogDescription>
          </DialogHeader>
          {fiscal.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : fiscal.error ? (
            <p className="text-sm text-destructive">
              {fiscal.error instanceof Error
                ? fiscal.error.message
                : 'No se pudo leer el JSON fiscal'}
            </p>
          ) : (
            <pre className="max-h-[55vh] overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
              {JSON.stringify(fiscal.data ?? {}, null, 2)}
            </pre>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(JSON.stringify(fiscal.data ?? {}, null, 2));
                toast.success('JSON copiado');
              }}
            >
              <Copy data-icon="inline-start" /> Copiar
            </Button>
            <Button
              onClick={() => {
                const blob = new Blob([JSON.stringify(fiscal.data ?? {}, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `${data?.code ?? 'factura'}.fiscal.json`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download data-icon="inline-start" /> Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DocumentShell>
  );
}
