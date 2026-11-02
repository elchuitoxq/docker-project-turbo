'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Wallet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { payablesApi, type Payable, type PayableStatus } from '../api/payables';
import { PaymentDialog } from './payment-dialog';
import { useBranchStore } from '@/stores/use-branch-store';
import { formatMoney, formatDual, formatDay } from '@/lib/utils';
import { BASE_CURRENCY_CODE, findRate, isRateStale, useLatestRates } from '@/lib/rates';
import { StaleRateGate } from '@/components/finance/stale-rate-gate';
import { PERMISSIONS } from '@/lib/permissions';
import { usePermission } from '@/hooks/use-permission';

const STATUS_LABEL: Record<PayableStatus, string> = {
  PENDING: 'Pendiente',
  PARTIAL: 'Abonada',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
};

const STATUS_VARIANT: Record<PayableStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  PARTIAL: 'outline',
  PAID: 'default',
  OVERDUE: 'destructive',
};

export function PayablesView() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canPay = hasPermission(PERMISSIONS.FINANCE.PAYMENTS.CREATE);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<'ALL' | PayableStatus>('ALL');
  const [paying, setPaying] = React.useState<Payable | null>(null);

  const payables = useQuery({
    queryKey: ['payables', { status }],
    queryFn: () => payablesApi.list(status === 'ALL' ? {} : { status }),
  });

  const aging = useQuery({ queryKey: ['payables', 'aging'], queryFn: () => payablesApi.aging() });

  const rows = React.useMemo(() => {
    const list = payables.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      row =>
        row.code.toLowerCase().includes(q) ||
        row.partnerName.toLowerCase().includes(q) ||
        (row.supplierInvoiceNumber ?? '').toLowerCase().includes(q)
    );
  }, [payables.data, search]);

  // Los saldos de documentos en divisa se convierten con la tasa del documento (`H-102`).
  const totalBalance = rows.reduce((sum, row) => sum + row.balanceBase, 0);
  const totalOverdue = rows.reduce(
    (sum, row) => (row.status === 'OVERDUE' ? sum + row.balanceBase : sum),
    0
  );
  const baseCode = aging.data?.baseCurrencyCode === 'VES' ? 'VES' : 'USD';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas por pagar</h1>
        <p className="text-sm text-muted-foreground">
          Antigüedad de saldos por proveedor, con retenciones y notas de crédito descontadas
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Saldo total ({baseCode})</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(totalBalance, baseCode)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Vencido</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {formatMoney(totalOverdue, baseCode)}
              {totalOverdue > 0 && <AlertTriangle className="text-destructive" />}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Por vencer</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(
                aging.data?.buckets.find(b => b.bucket === 'CURRENT')?.total ?? 0,
                baseCode
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Más de 90 días</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(
                aging.data?.buckets.find(b => b.bucket === 'D90_PLUS')?.total ?? 0,
                baseCode
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Antigüedad de saldos</CardTitle>
          <CardDescription>
            {aging.data
              ? `Al ${formatDay(aging.data.asOf)} · ${aging.data.byPartner.length} proveedores`
              : 'Calculando…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aging.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-5">
              {(aging.data?.buckets ?? []).map(bucket => (
                <div key={bucket.bucket} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{bucket.label}</p>
                  <p className="text-lg font-medium">{formatMoney(bucket.total, baseCode)}</p>
                  <p className="text-xs text-muted-foreground">{bucket.invoices} facturas</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar por factura o proveedor…"
                className="pl-8"
              />
            </div>
            <Select
              value={status}
              onValueChange={value => setStatus(value as 'ALL' | PayableStatus)}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="PARTIAL">Abonada</SelectItem>
                <SelectItem value="OVERDUE">Vencida</SelectItem>
                <SelectItem value="PAID">Pagada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {payables.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay cuentas por pagar con estos filtros.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Retenido</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.invoiceId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          href={`/dashboard/finance/invoices/${row.invoiceId}`}
                          className="font-medium hover:underline"
                        >
                          {row.code}
                        </Link>
                        {row.supplierInvoiceNumber && (
                          <span className="text-xs text-muted-foreground">
                            Prov. {row.supplierInvoiceNumber}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{row.partnerName}</span>
                        <span className="text-xs text-muted-foreground">{row.partnerTaxId}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDay(row.issueDate)}</TableCell>
                    <TableCell>
                      {row.dueDate ? (
                        <div className="flex flex-col">
                          <span>{formatDay(row.dueDate)}</span>
                          {row.daysOverdue > 0 && (
                            <span className="text-xs text-destructive">
                              {row.daysOverdue} días vencida
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sin vencimiento</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span>{formatMoney(row.total, row.currencyCode)}</span>
                        {row.currencyCode !== baseCode && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatMoney(row.totalBase, baseCode)} @ {row.exchangeRate}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(row.retained, baseCode)}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(row.paid, baseCode)}</TableCell>
                    <TableCell className="text-right font-medium">
                      <div className="flex flex-col items-end">
                        <span>{formatMoney(row.balance, row.currencyCode)}</span>
                        {row.currencyCode !== baseCode && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatMoney(row.balanceBase, baseCode)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canPay && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={row.balance <= 0}
                          onClick={() => setPaying(row)}
                        >
                          <Wallet data-icon="inline-start" />
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {paying && (
        <PaymentDialog
          invoiceId={paying.invoiceId}
          code={paying.code}
          partnerId={paying.partnerId}
          partnerName={paying.partnerName}
          balance={paying.balance}
          currencyId={paying.currencyId}
          currencyCode={paying.currencyCode}
          invoiceRate={paying.exchangeRate}
          direction="EXPENSE"
          onClose={() => setPaying(null)}
          onDone={async () => {
            setPaying(null);
            await queryClient.invalidateQueries({ queryKey: ['payables'] });
          }}
        />
      )}
    </div>
  );
}
