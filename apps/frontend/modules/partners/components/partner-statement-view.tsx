'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, FileText, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { usePartnerStatement, usePartner } from '../hooks/use-partners';

const TYPE_LABEL = {
  INVOICE: 'Factura',
  CREDIT_NOTE: 'Nota de crédito',
  PAYMENT: 'Pago',
} as const;

const TYPE_VARIANT = {
  INVOICE: 'default',
  CREDIT_NOTE: 'destructive',
  PAYMENT: 'secondary',
} as const;

const TYPE_ICON = {
  INVOICE: FileText,
  CREDIT_NOTE: ArrowDown,
  PAYMENT: ArrowUp,
} as const;

type Props = { partnerId: string };

export function PartnerStatementView({ partnerId }: Props) {
  const { data: partner, isLoading: loadingPartner } = usePartner(partnerId);
  const { data: statement, isLoading: loadingStatement } = usePartnerStatement(partnerId);
  const movements = statement
    ? [
        ...statement.outstandingInvoices.map(invoice => ({
          id: invoice.id,
          code: invoice.code,
          date: invoice.date,
          label: 'Factura pendiente',
          debit: invoice.total,
          credit: invoice.paid,
          balance: invoice.pending,
          type: 'INVOICE' as const,
        })),
        ...statement.recentPayments.map(payment => ({
          id: payment.id,
          code: payment.code,
          date: payment.date,
          label: payment.type === 'EXPENSE' ? 'Pago realizado' : 'Pago recibido',
          debit: payment.type === 'EXPENSE' ? payment.amount : 0,
          credit: payment.type === 'INCOME' ? payment.amount : 0,
          balance: 0,
          type: 'PAYMENT' as const,
        })),
      ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
    : [];

  if (loadingPartner || loadingStatement) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!partner || !statement) {
    return <p className="text-sm text-muted-foreground">No se pudo cargar el estado de cuenta.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{partner.name}</h1>
        <p className="text-sm text-muted-foreground">RIF: {partner.taxId} · Estado de cuenta</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Saldo actual</CardDescription>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(Number(statement.totalOutstanding))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {Number(statement.totalOutstanding) > 0
                ? 'Facturas por cobrar'
                : 'Sin saldo pendiente'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Total pagado</CardDescription>
            <TrendingUp className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(Number(statement.totalPaid))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Pagos registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Saldo neto</CardDescription>
            <TrendingDown className="size-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(Number(statement.creditBalance))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Pagado menos pendiente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Límite de crédito</CardDescription>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(Number(partner.creditLimit))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {Number(partner.creditLimit) > 0
                ? `Disponible: ${formatCurrency(Math.max(0, Number(partner.creditLimit) - Number(statement.totalOutstanding)))}`
                : 'Sin límite configurado'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos</CardTitle>
          <CardDescription>
            {movements.length} movimiento{movements.length === 1 ? '' : 's'} registrado
            {movements.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                    No hay movimientos en el período
                  </TableCell>
                </TableRow>
              ) : (
                movements.map(line => {
                  const Icon = TYPE_ICON[line.type];
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="text-xs">
                        {line.date ? formatDate(line.date) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_VARIANT[line.type]} className="gap-1">
                          <Icon className="size-3" />
                          {TYPE_LABEL[line.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{line.code}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{line.label}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sky-600">
                        {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(line.balance)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
