'use client';

import * as React from 'react';
import Link from 'next/link';
import { Coins, CalendarDays, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { Skeleton } from '@/components/ui/skeleton';
import { useGeneratePayroll, usePayrolls } from '../hooks';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PayrollRun, PayrollRunStatus } from '../api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/use-auth-store';

const STATUS_LABEL: Record<PayrollRunStatus, string> = {
  DRAFT: 'Borrador',
  PROCESSED: 'Procesada',
  PAID: 'Pagada',
};

const STATUS_VARIANT: Record<PayrollRunStatus, 'secondary' | 'outline' | 'default'> = {
  DRAFT: 'secondary',
  PROCESSED: 'outline',
  PAID: 'default',
};

export function PayrollView() {
  const [status, setStatus] = React.useState<string>('ALL');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const branchId = useAuthStore(state => state.user?.defaultBranchId ?? '');
  const canProcess = permissions.includes(PERMISSIONS.HR.PAYROLL.PROCESS);

  const { data, isLoading } = usePayrolls({ ...(status !== 'ALL' && { status }) });
  const generate = useGeneratePayroll();

  const runs: PayrollRun[] = data ?? [];
  const totalNet = runs.reduce((total, run) => total + Number(run.totalAmount ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nómina</h1>
          <p className="text-muted-foreground text-sm">
            Cálculo por concepto, pago contra tesorería y recibos con desglose
          </p>
        </div>
        {canProcess ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus data-icon="inline-start" />
            Generar nómina
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-muted-foreground text-xs">Períodos</p>
              <p className="text-2xl font-bold tabular-nums">{runs.length}</p>
            </div>
            <CalendarDays className="text-muted-foreground size-5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-muted-foreground text-xs">Neto acumulado</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalNet)}</p>
            </div>
            <Coins className="text-primary size-5" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            El pago se registra desde el detalle del período
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Períodos de nómina</CardTitle>
          <CardDescription>
            {isLoading ? 'Cargando…' : `${runs.length} resultado${runs.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              No hay nóminas generadas
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead className="text-right">Neto a pagar</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(run => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">{run.code}</TableCell>
                    <TableCell className="text-xs">
                      {formatDate(run.startDate)} – {formatDate(run.endDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{run.frequency}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(Number(run.totalAmount ?? 0))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[run.status]}>{STATUS_LABEL[run.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/hr/payroll/${run.id}`}>Ver detalle</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar nómina</DialogTitle>
            <DialogDescription>
              Se calcula con el catálogo de conceptos de la empresa y los parámetros vigentes al
              cierre del período. Esos parámetros quedan congelados en el período.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              generate.mutate(
                {
                  branchId,
                  frequency: String(form.get('frequency') ?? 'MONTHLY'),
                  currencyId: String(form.get('currencyId') ?? '').trim(),
                  startDate: String(form.get('startDate') ?? ''),
                  endDate: String(form.get('endDate') ?? ''),
                },
                {
                  onSuccess: () => {
                    toast.success('Nómina generada');
                    setDialogOpen(false);
                  },
                  onError: error =>
                    toast.error(
                      error instanceof Error ? error.message : 'No se pudo generar la nómina'
                    ),
                }
              );
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="startDate">Desde</FieldLabel>
                <Input id="startDate" name="startDate" type="date" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">Hasta</FieldLabel>
                <Input id="endDate" name="endDate" type="date" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="frequency">Frecuencia</FieldLabel>
                <Select name="frequency" defaultValue="MONTHLY">
                  <SelectTrigger id="frequency">
                    <SelectValue placeholder="Frecuencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="MONTHLY">Mensual</SelectItem>
                      <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                      <SelectItem value="WEEKLY">Semanal</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="currencyId">Moneda (ID)</FieldLabel>
                <Input
                  id="currencyId"
                  name="currencyId"
                  className="font-mono"
                  placeholder="00000000-0000-4000-8000-000000000021"
                  required
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={generate.isPending}>
                {generate.isPending ? 'Generando…' : 'Generar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
