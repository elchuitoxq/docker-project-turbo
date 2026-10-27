'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Lock, LockOpen, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { dailyCloseApi, type DailyClose } from '../api/daily-close';
import { apiClient } from '@/lib/api/client';
import { formatCurrency, formatDay } from '@/lib/utils';

type Currency = { id: string; code: string; isBase?: boolean };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cierre diario con diferencia de caja (`T-05-09`).
 *
 * El día se elige explícitamente: el cierre es un acto sobre una fecha, no un listado. El efectivo
 * esperado es `apertura + neto de efectivo del día`, que es contra lo que se compara el conteo.
 */
export function DailyCloseView() {
  const queryClient = useQueryClient();
  const [date, setDate] = React.useState(today());
  const [closing, setClosing] = React.useState(false);
  const [reopening, setReopening] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['daily-close', date],
    queryFn: () => dailyCloseApi.get(date),
    enabled: Boolean(date),
  });

  const invalidate = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['daily-close'] }),
    [queryClient]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cierre diario</h1>
          <p className="text-sm text-muted-foreground">
            Totales del día por método y moneda, con diferencia entre lo esperado y lo contado
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Field className="w-45">
            <FieldLabel htmlFor="close-date">Fecha</FieldLabel>
            <Input
              id="close-date"
              type="date"
              value={date}
              onChange={event => setDate(event.target.value)}
            />
          </Field>
          {data?.status === 'CLOSED' ? (
            <Button variant="outline" onClick={() => setReopening(true)}>
              <LockOpen data-icon="inline-start" />
              Reabrir
            </Button>
          ) : (
            <Button onClick={() => setClosing(true)} disabled={!data}>
              <Lock data-icon="inline-start" />
              Cerrar día
            </Button>
          )}
        </div>
      </div>

      {isLoading || !data ? <Skeleton className="h-40 w-full" /> : <CloseSummary close={data} />}

      {data?.status === 'CLOSED' && data.reopenReason && (
        <p className="text-xs text-muted-foreground">
          Última reapertura: {data.reopenReason}
          {data.reopenedAt ? ` · ${formatDay(data.reopenedAt.slice(0, 10))}` : ''}
        </p>
      )}

      {closing && data && (
        <CloseDialog
          date={date}
          close={data}
          onClose={() => setClosing(false)}
          onDone={async () => {
            setClosing(false);
            await invalidate();
          }}
        />
      )}

      {reopening && (
        <ReopenDialog
          date={date}
          onClose={() => setReopening(false)}
          onDone={async () => {
            setReopening(false);
            await invalidate();
          }}
        />
      )}
    </div>
  );
}

function CloseSummary({ close }: { close: DailyClose }) {
  // Los agregados vienen en moneda funcional; el desglose por moneda trae su importe original.
  const currencies = useQuery({
    queryKey: ['currencies'],
    queryFn: () => apiClient.get<Currency[]>('/settings/currencies'),
  });
  const baseCode =
    currencies.data?.find(currency => currency.isBase)?.code === 'VES' ? 'VES' : 'USD';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Ingresos ({baseCode})</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(close.totalIncome, baseCode)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Egresos ({baseCode})</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(close.totalExpense, baseCode)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Neto ({baseCode})</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(close.netBalance, baseCode)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <CalendarCheck className="size-3.5" /> Estado
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Badge variant={close.status === 'CLOSED' ? 'default' : 'secondary'}>
                {close.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
              </Badge>
              <span className="text-sm font-normal text-muted-foreground">
                {close.paymentsCount} movimientos
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {close.status === 'CLOSED' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuadre de caja</CardTitle>
            <CardDescription>
              Apertura {formatCurrency(close.openingCash ?? 0)} · esperado{' '}
              {formatCurrency(close.expectedCash ?? 0)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Contado</p>
              <p className="text-lg font-medium">
                {close.cashCount === null || close.cashCount === undefined
                  ? '—'
                  : formatCurrency(close.cashCount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Diferencia</p>
              <p
                className={cnDifference(
                  close.difference === null || close.difference === undefined ? 0 : close.difference
                )}
              >
                {close.difference === null || close.difference === undefined
                  ? '—'
                  : formatCurrency(close.difference)}
              </p>
            </div>
            {(close.difference ?? 0) !== 0 && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="size-3.5" /> Revisa el efectivo antes de operar el
                siguiente día
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por método de pago</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Ingresos ({baseCode})</TableHead>
                  <TableHead className="text-right">Egresos ({baseCode})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {close.byPaymentMethod.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      Sin movimientos
                    </TableCell>
                  </TableRow>
                ) : (
                  close.byPaymentMethod.map(row => (
                    <TableRow key={row.methodName}>
                      <TableCell>{row.methodName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.income, baseCode)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.expense, baseCode)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por moneda</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Egresos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {close.byCurrency.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      Sin movimientos
                    </TableCell>
                  </TableRow>
                ) : (
                  close.byCurrency.map(row => (
                    <TableRow key={row.currencyCode}>
                      <TableCell>{row.currencyCode}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.income, row.currencyCode === 'VES' ? 'VES' : 'USD')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.expense, row.currencyCode === 'VES' ? 'VES' : 'USD')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cnDifference(value: number): string {
  return `text-lg font-medium ${value === 0 ? '' : value > 0 ? 'text-emerald-600' : 'text-destructive'}`;
}

function CloseDialog({
  date,
  close,
  onClose,
  onDone,
}: {
  date: string;
  close: DailyClose;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [notes, setNotes] = React.useState('');
  const [openingCash, setOpeningCash] = React.useState('0');
  const [cashCount, setCashCount] = React.useState('');

  const mutation = useMutation({
    mutationFn: () =>
      dailyCloseApi.close(date, {
        notes: notes || undefined,
        openingCash: Number(openingCash || 0),
        ...(cashCount === '' ? {} : { cashCount: Number(cashCount) }),
      }),
    onSuccess: async () => {
      toast.success(`Cierre del ${date} guardado`);
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo cerrar el día'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar {formatDay(date)}</DialogTitle>
          <DialogDescription>
            Ingresos {formatCurrency(close.totalIncome)} · egresos{' '}
            {formatCurrency(close.totalExpense)}. Al cerrar, la fecha no admite más movimientos.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="opening-cash">Efectivo de apertura</FieldLabel>
            <Input
              id="opening-cash"
              type="number"
              min={0}
              step="0.01"
              value={openingCash}
              onChange={event => setOpeningCash(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cash-count">Efectivo contado</FieldLabel>
            <Input
              id="cash-count"
              type="number"
              min={0}
              step="0.01"
              value={cashCount}
              placeholder="Opcional"
              onChange={event => setCashCount(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="close-notes">Notas</FieldLabel>
            <Textarea
              id="close-notes"
              value={notes}
              onChange={event => setNotes(event.target.value)}
              rows={2}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Cerrar día
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReopenDialog({
  date,
  onClose,
  onDone,
}: {
  date: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] = React.useState('');

  const mutation = useMutation({
    mutationFn: () => dailyCloseApi.reopen(date, reason),
    onSuccess: async () => {
      toast.success(`Cierre del ${date} reabierto`);
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo reabrir el día'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir {formatDay(date)}</DialogTitle>
          <DialogDescription>
            La reapertura queda auditada con tu usuario y el motivo. Después habrá que volver a
            cerrar el día.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="reopen-reason">Motivo</FieldLabel>
            <Textarea
              id="reopen-reason"
              value={reason}
              onChange={event => setReason(event.target.value)}
              rows={3}
              placeholder="Se registró un pago después del cierre"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!reason.trim() || mutation.isPending}>
            Reabrir día
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
