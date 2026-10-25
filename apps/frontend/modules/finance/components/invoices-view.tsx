'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus,
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
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice, InvoiceStatus } from '../api/invoices';

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Emitida',
  VOID: 'Anulada',
};

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive'> = {
  DRAFT: 'secondary',
  POSTED: 'default',
  VOID: 'destructive',
};

export function InvoicesView({ type }: { type: 'SALE' | 'PURCHASE' }) {
  const t = useTranslations('common');
  const isMobile = useIsMobile();
  const { hasPermission } = usePermission();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<InvoiceStatus | 'ALL'>('ALL');
  const [voidOpen, setVoidOpen] = React.useState(false);
  const [voiding, setVoiding] = React.useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = React.useState('');

  const { data, isLoading } = useInvoices({ type, ...(status !== 'ALL' && { status }) });
  const { data: stats } = useInvoiceStats();
  const post = usePostInvoice();
  const voidInvoice = useVoidInvoice();

  const filtered = (data?.data ?? []).filter(
    (i) => !search || i.code.toLowerCase().includes(search.toLowerCase()) || (i.partnerName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {type === 'SALE' ? 'Facturación de ventas' : 'Facturación de compras'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {type === 'SALE' ? 'Facturas emitidas a clientes' : 'Facturas recibidas de proveedores'}
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
          <StatCard
            icon={FileEdit}
            label="Borradores"
            value={stats.draft}
            variant="secondary"
          />
          <StatCard
            icon={CheckCircle2}
            label="Emitidas"
            value={stats.posted}
            variant="default"
          />
          <StatCard
            icon={AlertCircle}
            label="Anuladas"
            value={stats.void}
            variant="destructive"
          />
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total emitido</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(Number(stats.totalPosted))}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                    <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus | 'ALL')}>
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
              <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus | 'ALL')}>
                <SelectTrigger className="w-48">
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
            {hasPermission(PERMISSIONS.FINANCE.INVOICES.CREATE) && (
              <Button>
                <Plus /> Nueva
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>{isLoading ? 'Cargando…' : `${filtered.length} factura${filtered.length === 1 ? '' : 's'}`}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay facturas</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Vence</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/dashboard/finance/invoices`} className="hover:underline">
                        {inv.code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell>{inv.partnerName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(inv.total), inv.currencyCode === 'VES' ? 'VES' : 'USD')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              const blob = new Blob([JSON.stringify(inv, null, 2)], { type: 'application/json' });
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
                          {inv.status === 'DRAFT' && hasPermission(PERMISSIONS.FINANCE.INVOICES.POST) && (
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
                          {inv.status === 'POSTED' && hasPermission(PERMISSIONS.FINANCE.INVOICES.VOID) && (
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={voidOpen} onOpenChange={setVoidOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Anular factura</SheetTitle>
            <SheetDescription>
              {voiding ? `Vas a anular ${voiding.code}. Esta acción no se puede deshacer.` : ''}
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={async (e) => {
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
                  onChange={(e) => setVoidReason(e.target.value)}
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
              <Button type="submit" variant="destructive" disabled={!voidReason || voidInvoice.isPending}>
                Confirmar anulación
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
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
