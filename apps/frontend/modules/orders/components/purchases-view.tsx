'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ListCard,
  ListEmptyRow,
  ListFilters,
  ListSkeletonRows,
  ListTd,
  ListTh,
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/list/list-table';
import { payablesApi, type PayableStatus } from '@/modules/finance/api/payables';
import { formatMoney, formatDay } from '@/lib/utils';
import { useCurrencyIndex } from '@/lib/currency';

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

/**
 * Listado de compras con saldo, vencimiento y retenciones (`T-03-08`).
 *
 * La fuente es `payables`: una compra en borrador no es una obligación y no aparece aquí; se crea y
 * se publica desde el detalle de facturación.
 */
export function PurchasesView() {
  const { baseCode } = useCurrencyIndex();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<'ALL' | PayableStatus>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['payables', 'purchases', { status }],
    queryFn: () => payablesApi.list(status === 'ALL' ? {} : { status }),
  });

  const rows = React.useMemo(() => {
    const list = data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      row =>
        row.code.toLowerCase().includes(q) ||
        row.partnerName.toLowerCase().includes(q) ||
        (row.supplierInvoiceNumber ?? '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const pending = rows.reduce((sum, row) => sum + Math.max(0, row.balance), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Facturas de proveedor publicadas · saldo pendiente {formatMoney(pending, baseCode)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/finance/payables">
            <Wallet data-icon="inline-start" />
            Cuentas por pagar
          </Link>
        </Button>
      </div>

      <ListFilters>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por factura o proveedor…"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={value => setStatus(value as 'ALL' | PayableStatus)}>
          <SelectTrigger className="w-full sm:w-48">
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
      </ListFilters>

      <ListCard
        title="Compras publicadas"
        description={
          isLoading
            ? 'Cargando…'
            : `${rows.length} factura${rows.length === 1 ? '' : 's'} de proveedor`
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ListTh>Factura</ListTh>
              <ListTh>Proveedor</ListTh>
              <ListTh>Emisión</ListTh>
              <ListTh>Vencimiento</ListTh>
              <ListTh align="right">Total</ListTh>
              <ListTh align="right">Retenido</ListTh>
              <ListTh align="right">Saldo</ListTh>
              <ListTh>Estado</ListTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <ListSkeletonRows cols={8} />
            ) : rows.length === 0 ? (
              <ListEmptyRow
                cols={8}
                message="No hay compras publicadas."
                hint="Registra una factura de compra en Facturación para verla aquí."
              />
            ) : (
              rows.map(row => (
                <TableRow key={row.invoiceId}>
                  <ListTd>
                    <div className="flex flex-col">
                      <Link
                        href={`/dashboard/operations/purchases/${row.invoiceId}`}
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
                  </ListTd>
                  <ListTd>
                    <div className="flex flex-col">
                      <span>{row.partnerName}</span>
                      <span className="text-xs text-muted-foreground">{row.partnerTaxId}</span>
                    </div>
                  </ListTd>
                  <ListTd className="text-xs">{formatDay(row.issueDate)}</ListTd>
                  <ListTd className="text-xs">
                    {row.dueDate ? formatDay(row.dueDate) : '—'}
                    {row.daysOverdue > 0 && (
                      <span className="ml-1 text-destructive">({row.daysOverdue} d)</span>
                    )}
                  </ListTd>
                  <ListTd numeric>{formatMoney(row.total, row.currencyCode)}</ListTd>
                  <ListTd numeric muted>
                    {formatMoney(row.retained, baseCode)}
                  </ListTd>
                  <ListTd numeric className="font-medium">
                    {formatMoney(row.balance, row.currencyCode)}
                  </ListTd>
                  <ListTd>
                    <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  </ListTd>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  );
}
