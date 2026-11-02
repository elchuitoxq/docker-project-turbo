'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Search,
  MoreHorizontal,
  Receipt,
  Check,
  X,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Plus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ListCard,
  ListEmptyRow,
  ListFilters,
  ListRowActions,
  ListSkeletonRows,
  ListTd,
  ListTh,
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/list/list-table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import {
  useInvoices,
  useInvoiceStats,
  usePostInvoice,
  useVoidInvoice,
} from '../hooks/use-invoices';
import { formatMoney, formatDate } from '@/lib/utils';
import { useCurrencyIndex } from '@/lib/currency';
import { InvoiceFormDialog } from './invoice-form-dialog';
import { statusLabel, statusVariant } from '@/modules/documents/status';
import type { Invoice, InvoiceStatus } from '../api/invoices';

// El catálogo de estados es uno solo (`S-10`): con una copia local, `PAID`/`PARTIAL` aparecían como
// enum crudo en el listado (`S-17` M-32).

export function InvoicesView({ type }: { type: 'SALE' | 'PURCHASE' }) {
  const t = useTranslations('common');
  const isMobile = useIsMobile();
  const { hasPermission } = usePermission();
  const { baseCode, codeOf } = useCurrencyIndex();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<InvoiceStatus | 'ALL'>('ALL');
  const [voidOpen, setVoidOpen] = React.useState(false);
  const [voiding, setVoiding] = React.useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);

  const { data, isLoading } = useInvoices({ type, ...(status !== 'ALL' && { status }) });
  const { data: stats } = useInvoiceStats(type);
  const post = usePostInvoice();
  const voidInvoice = useVoidInvoice();

  const filtered = (data?.data ?? []).filter(
    i =>
      !search ||
      i.code.toLowerCase().includes(search.toLowerCase()) ||
      (i.partnerName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {type === 'SALE' ? 'Facturación de ventas' : 'Facturación de compras'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {type === 'SALE' ? 'Facturas emitidas a clientes' : 'Facturas recibidas de proveedores'}
          </p>
        </div>
        {hasPermission(PERMISSIONS.FINANCE.INVOICES.CREATE) && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus /> Nueva factura
          </Button>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
          <StatCard
            icon={FileEdit}
            label="Borradores"
            value={stats.draftCount}
            variant="secondary"
          />
          <StatCard
            icon={CheckCircle2}
            label="Emitidas"
            value={stats.postedCount}
            variant="default"
          />
          <StatCard
            icon={AlertCircle}
            label="Anuladas"
            value={stats.voidCount}
            variant="destructive"
          />
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total facturado ({baseCode})</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatMoney(Number(stats.totalAmount ?? 0), baseCode)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <ListFilters>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código o partner…"
            className="pl-8"
          />
        </div>
        {isMobile ? (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <Select value={status} onValueChange={v => setStatus(v as InvoiceStatus | 'ALL')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los estados</SelectItem>
                    <SelectItem value="DRAFT">Borrador</SelectItem>
                    <SelectItem value="POSTED">Emitida</SelectItem>
                    <SelectItem value="VOID">Anulada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Select value={status} onValueChange={v => setStatus(v as InvoiceStatus | 'ALL')}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="POSTED">Emitida</SelectItem>
              <SelectItem value="VOID">Anulada</SelectItem>
            </SelectContent>
          </Select>
        )}
      </ListFilters>

      <ListCard
        title="Listado"
        description={
          isLoading ? 'Cargando…' : `${filtered.length} factura${filtered.length === 1 ? '' : 's'}`
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ListTh>Código</ListTh>
              <ListTh>Fecha</ListTh>
              <ListTh>Partner</ListTh>
              <ListTh>Estado</ListTh>
              <ListTh hide="md">Vence</ListTh>
              <ListTh hide="lg">Moneda</ListTh>
              <ListTh align="right">Total</ListTh>
              <ListTh className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <ListSkeletonRows cols={8} />
            ) : filtered.length === 0 ? (
              <ListEmptyRow cols={8} message="No hay facturas registradas." />
            ) : (
              filtered.map(inv => (
                <TableRow key={inv.id}>
                  <ListTd mono>
                    <Link
                      href={`/dashboard/finance/invoices/${inv.id}`}
                      className="hover:underline"
                    >
                      {inv.code}
                    </Link>
                  </ListTd>
                  <ListTd className="text-xs">{formatDate(inv.date)}</ListTd>
                  <ListTd>{inv.partnerName ?? '—'}</ListTd>
                  <ListTd>
                    <Badge variant={statusVariant(inv.status)}>{statusLabel(inv.status)}</Badge>
                  </ListTd>
                  <ListTd hide="md" muted className="text-xs">
                    {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                  </ListTd>
                  <ListTd hide="lg" muted className="text-xs">
                    {codeOf(inv.currencyId)}
                    {inv.exchangeRate && Number(inv.exchangeRate) !== 1 && (
                      <span className="block">Tasa {Number(inv.exchangeRate)}</span>
                    )}
                  </ListTd>
                  <ListTd numeric>{formatMoney(Number(inv.total), codeOf(inv.currencyId))}</ListTd>
                  <ListTd className="w-12">
                    <ListRowActions label={`Acciones de ${inv.code}`}>
                      <DropdownMenuItem
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(inv, null, 2)], {
                            type: 'application/json',
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${inv.code}.fiscal.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download /> JSON Fiscal
                      </DropdownMenuItem>
                      {inv.status === 'DRAFT' &&
                        hasPermission(PERMISSIONS.FINANCE.INVOICES.POST) && (
                          <DropdownMenuItem
                            onClick={() =>
                              post.mutate(inv.id, {
                                onSuccess: () => toast.success('Factura emitida'),
                                onError: () => toast.error('Error al emitir'),
                              })
                            }
                          >
                            <Check /> Emitir
                          </DropdownMenuItem>
                        )}
                      {inv.status === 'POSTED' &&
                        hasPermission(PERMISSIONS.FINANCE.INVOICES.VOID) && (
                          <DropdownMenuItem
                            onClick={() => {
                              setVoiding(inv);
                              setVoidReason('');
                              setVoidOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <X /> Anular
                          </DropdownMenuItem>
                        )}
                    </ListRowActions>
                  </ListTd>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ListCard>

      <Sheet open={voidOpen} onOpenChange={setVoidOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Anular factura</SheetTitle>
            <SheetDescription>
              {voiding ? `Vas a anular ${voiding.code}. Esta acción no se puede deshacer.` : ''}
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={async e => {
              e.preventDefault();
              if (!voiding || !voidReason) return;
              await voidInvoice.mutateAsync({ id: voiding.id, reason: voidReason });
              toast.success('Factura anulada');
              setVoidOpen(false);
              setVoiding(null);
            }}
            className="mt-6 space-y-4"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="void-reason">Motivo *</FieldLabel>
                <textarea
                  id="void-reason"
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  required
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Describe el motivo de la anulación…"
                />
              </Field>
            </FieldGroup>
            <SheetFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setVoidOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!voidReason || voidInvoice.isPending}
              >
                Confirmar anulación
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {hasPermission(PERMISSIONS.FINANCE.INVOICES.CREATE) && (
        <InvoiceFormDialog open={formOpen} onOpenChange={setFormOpen} defaultType={type} />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  variant: 'default' | 'secondary' | 'destructive';
}) {
  const colorClass =
    variant === 'destructive'
      ? 'text-destructive'
      : variant === 'default'
        ? 'text-emerald-600'
        : 'text-muted-foreground';
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <Icon className={`size-5 ${colorClass}`} />
      </CardContent>
    </Card>
  );
}
