'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  FileText,
  Wallet,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDay } from '@/lib/utils';
import { usePartnerStatement, usePartner } from '../hooks/use-partners';

const TYPE_LABEL = {
  INVOICE: 'Documento',
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

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

/**
 * Estado de cuenta del partner (`T-05-06`, `T-05-09`).
 *
 * Con rango de fechas el backend devuelve saldo inicial, todos los movimientos del período con saldo
 * corrido y saldo final; sin rango se mantiene el resumen histórico.
 */
export function PartnerStatementView({ partnerId }: Props) {
  const [from, setFrom] = React.useState(monthStart());
  const [to, setTo] = React.useState(new Date().toISOString().slice(0, 10));

  const { data: partner, isLoading: loadingPartner } = usePartner(partnerId);
  const { data: statement, isLoading: loadingStatement } = usePartnerStatement(partnerId, {
    from,
    to,
  });

  const movements = statement?.movements ?? [];
  const hasRange = movements.length > 0;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{partner.name}</h1>
          <p className="text-sm text-muted-foreground">RIF: {partner.taxId} · Estado de cuenta</p>
        </div>
        <FieldGroup className="flex-row items-end">
          <Field className="w-40">
            <FieldLabel htmlFor="statement-from">Desde</FieldLabel>
            <Input
              id="statement-from"
              type="date"
              value={from}
              onChange={event => setFrom(event.target.value)}
            />
          </Field>
          <Field className="w-40">
            <FieldLabel htmlFor="statement-to">Hasta</FieldLabel>
            <Input
              id="statement-to"
              type="date"
              value={to}
              onChange={event => setTo(event.target.value)}
            />
          </Field>
        </FieldGroup>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Saldo inicial</CardDescription>
            <CalendarRange className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(Number(statement.openingBalance ?? 0))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Antes del {formatDay(from)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Saldo del rango</CardDescription>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(Number(statement.closingBalance ?? 0))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Al {formatDay(to)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Total pendiente</CardDescription>
            <TrendingUp className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(Number(statement.totalOutstanding))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Facturas abiertas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Límite de crédito</CardDescription>
            <TrendingDown className="size-4 text-sky-600" />
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
          <CardTitle className="text-base">Movimientos del rango</CardTitle>
          <CardDescription>
            {hasRange
              ? `${movements.length} movimiento${movements.length === 1 ? '' : 's'} · saldo inicial + cargos − abonos = saldo final`
              : 'Sin movimientos registrados en el rango seleccionado'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">Cargo</TableHead>
                <TableHead className="text-right">Abono</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    No hay movimientos en el período
                  </TableCell>
                </TableRow>
              ) : (
                movements.map(line => {
                  const Icon = TYPE_ICON[line.type];

                  return (
                    <TableRow key={`${line.type}-${line.documentCode}`}>
                      <TableCell className="text-xs">{formatDay(line.date)}</TableCell>
                      <TableCell>
                        <Badge variant={TYPE_VARIANT[line.type]} className="gap-1">
                          <Icon className="size-3" />
                          {TYPE_LABEL[line.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs">{line.documentCode}</span>
                          <span className="text-xs text-muted-foreground">{line.description}</span>
                        </div>
                      </TableCell>
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
