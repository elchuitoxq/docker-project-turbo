'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { payablesApi, type PayableStatus } from '@/modules/finance/api/payables';
import { formatCurrency, formatDay } from '@/lib/utils';

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
            Facturas de proveedor publicadas · saldo pendiente {formatCurrency(pending)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/finance/payables">
            <Wallet data-icon="inline-start" />
            Cuentas por pagar
          </Link>
        </Button>
      </div>

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
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <FileText className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay compras publicadas. Registra una factura de compra en Facturación para verla
                aquí.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/finance/invoices">Ir a facturación</Link>
              </Button>
            </div>
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
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.invoiceId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.code}</span>
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
                      {row.dueDate ? formatDay(row.dueDate) : '—'}
                      {row.daysOverdue > 0 && (
                        <span className="ml-1 text-xs text-destructive">({row.daysOverdue} d)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.total, row.currencyCode === 'VES' ? 'VES' : 'USD')}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.retained)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.balance)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
