'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, FileBarChart, Lock, LockOpen, Scale } from 'lucide-react';
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useBalanceSheet,
  useClosePeriod,
  useIncomeStatement,
  usePeriods,
  useReopenPeriod,
  useTrialBalance,
} from '@/modules/accounting/hooks';
import type { BalanceSheet, IncomeStatement, Period, TrialBalance } from '@/modules/accounting/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/use-auth-store';

const MONTH_LABEL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function money(value: number): string {
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PeriodsPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canClose = permissions.includes(PERMISSIONS.FINANCE.CLOSE.MANAGE);

  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(today());
  const [asOf, setAsOf] = useState(today());

  const periods = usePeriods(year);
  const trial = useTrialBalance(from, to);
  const balance = useBalanceSheet(asOf);
  const income = useIncomeStatement(from, to);

  const closePeriod = useClosePeriod();
  const reopenPeriod = useReopenPeriod();

  const [reopenTarget, setReopenTarget] = useState<Period | null>(null);
  const [reason, setReason] = useState('');

  const close = (period: Period) => {
    closePeriod.mutate(period.id, {
      onSuccess: () =>
        toast.success(`Período ${MONTH_LABEL[period.month - 1]} ${period.year} cerrado`),
      onError: error => toast.error(error.message),
    });
  };

  const reopen = () => {
    if (!reopenTarget) return;
    reopenPeriod.mutate(
      { id: reopenTarget.id, reason },
      {
        onSuccess: () => {
          toast.success(`Período ${MONTH_LABEL[reopenTarget.month - 1]} reabierto`);
          setReopenTarget(null);
          setReason('');
        },
        onError: error => toast.error(error.message),
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link href="/dashboard/finance/accounting">
              <ArrowLeft data-icon="inline-start" />
              Plan de cuentas
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Scale className="text-muted-foreground" />
            Cierre y reportes
          </h1>
          <p className="text-muted-foreground text-sm">
            Cerrar un mes bloquea los asientos de ese período. Reabrirlo exige motivo y queda
            auditado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/finance/accounting/entries">
              <BookOpen data-icon="inline-start" />
              Asientos
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="text-muted-foreground" />
            Períodos {year}
          </CardTitle>
          <CardDescription>
            {periods.isLoading
              ? 'Cargando…'
              : `${periods.data?.filter(period => period.status === 'CLOSED').length ?? 0} de 12 cerrados`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field className="w-32">
            <FieldLabel htmlFor="year">Año</FieldLabel>
            <Input
              id="year"
              type="number"
              value={year}
              onChange={event => setYear(Number(event.target.value) || currentYear)}
            />
          </Field>

          {periods.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Asientos</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.data?.map(period => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{MONTH_LABEL[period.month - 1]}</TableCell>
                    <TableCell>
                      <Badge variant={period.status === 'CLOSED' ? 'secondary' : 'outline'}>
                        {period.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{period.entries ?? 0}</TableCell>
                    <TableCell className="text-right">{money(period.totalDebit ?? 0)}</TableCell>
                    <TableCell className="text-right">{money(period.totalCredit ?? 0)}</TableCell>
                    <TableCell className="text-right">
                      {canClose ? (
                        period.status === 'CLOSED' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReopenTarget(period)}
                            disabled={reopenPeriod.isPending}
                          >
                            <LockOpen data-icon="inline-start" />
                            Reabrir
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => close(period)}
                            disabled={closePeriod.isPending}
                          >
                            <Lock data-icon="inline-start" />
                            Cerrar
                          </Button>
                        )
                      ) : (
                        <span className="text-muted-foreground text-xs">Sólo lectura</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="text-muted-foreground" />
            Estados financieros
          </CardTitle>
          <CardDescription>
            Sólo asientos posteados. El balance general incluye el resultado acumulado del
            ejercicio.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-40">
              <FieldLabel htmlFor="from">Desde</FieldLabel>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={event => setFrom(event.target.value)}
              />
            </Field>
            <Field className="w-40">
              <FieldLabel htmlFor="to">Hasta</FieldLabel>
              <Input id="to" type="date" value={to} onChange={event => setTo(event.target.value)} />
            </Field>
            <Field className="w-44">
              <FieldLabel htmlFor="asOf">Balance al</FieldLabel>
              <Input
                id="asOf"
                type="date"
                value={asOf}
                onChange={event => setAsOf(event.target.value)}
              />
            </Field>
          </div>

          <Tabs defaultValue="trial">
            <TabsList>
              <TabsTrigger value="trial">Balance de comprobación</TabsTrigger>
              <TabsTrigger value="balance">Balance general</TabsTrigger>
              <TabsTrigger value="income">Estado de resultados</TabsTrigger>
            </TabsList>

            <TabsContent value="trial">
              <TrialBalanceTable report={trial.data} loading={trial.isLoading} />
            </TabsContent>
            <TabsContent value="balance">
              <BalanceSheetView report={balance.data} loading={balance.isLoading} />
            </TabsContent>
            <TabsContent value="income">
              <IncomeStatementView report={income.data} loading={income.isLoading} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog
        open={!!reopenTarget}
        onOpenChange={value => {
          if (!value) {
            setReopenTarget(null);
            setReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir período</DialogTitle>
            <DialogDescription>
              {reopenTarget
                ? `${MONTH_LABEL[reopenTarget.month - 1]} ${reopenTarget.year} vuelve a admitir asientos. El motivo queda en la auditoría.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reason">Motivo</FieldLabel>
              <Input
                id="reason"
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder="Ajuste de retención omitida"
              />
              <FieldDescription>Obligatorio y queda registrado con tu usuario.</FieldDescription>
            </Field>
          </FieldGroup>
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={reopen} disabled={!reason.trim() || reopenPeriod.isPending}>
              Reabrir período
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrialBalanceTable({ report, loading }: { report?: TrialBalance; loading: boolean }) {
  if (loading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          {report?.rows.length ?? 0} cuentas con movimiento
        </span>
        {report ? (
          <Badge variant={report.balanced ? 'default' : 'destructive'}>
            {report.balanced ? 'Cuadra' : `Diferencia ${money(report.totals.difference)}`}
          </Badge>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Cuenta</TableHead>
            <TableHead className="text-right">Debe</TableHead>
            <TableHead className="text-right">Haber</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report?.rows.map(row => (
            <TableRow key={row.accountId}>
              <TableCell className="font-mono text-xs">{row.code}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right">{money(row.debit)}</TableCell>
              <TableCell className="text-right">{money(row.credit)}</TableCell>
              <TableCell className="text-right font-medium">{money(row.balance)}</TableCell>
            </TableRow>
          ))}
          {report ? (
            <TableRow>
              <TableCell colSpan={2} className="font-medium">
                Totales
              </TableCell>
              <TableCell className="text-right font-medium">{money(report.totals.debit)}</TableCell>
              <TableCell className="text-right font-medium">
                {money(report.totals.credit)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {money(report.totals.difference)}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function StatementRows({
  lines,
}: {
  lines: Array<{ accountId: string; code: string; name: string; balance: number }>;
}) {
  if (lines.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={3} className="text-muted-foreground text-sm">
          Sin movimientos en el rango.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {lines.map(line => (
        <TableRow key={line.accountId}>
          <TableCell className="font-mono text-xs">{line.code}</TableCell>
          <TableCell>{line.name}</TableCell>
          <TableCell className="text-right">{money(line.balance)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}

function BalanceSheetView({ report, loading }: { report?: BalanceSheet; loading: boolean }) {
  if (loading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">Al {report?.date.slice(0, 10)}</span>
        {report ? (
          <Badge variant={report.balanced ? 'default' : 'destructive'}>
            {report.balanced
              ? 'Activo = Pasivo + Patrimonio + Resultado'
              : `Diferencia ${money(report.totals.difference)}`}
          </Badge>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Cuenta</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={3} className="font-medium">
              Activo
            </TableCell>
          </TableRow>
          <StatementRows lines={report?.assets ?? []} />
          <TableRow>
            <TableCell colSpan={3} className="font-medium">
              Pasivo
            </TableCell>
          </TableRow>
          <StatementRows lines={report?.liabilities ?? []} />
          <TableRow>
            <TableCell colSpan={3} className="font-medium">
              Patrimonio
            </TableCell>
          </TableRow>
          <StatementRows lines={report?.equity ?? []} />
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Resultado del ejercicio
            </TableCell>
            <TableCell className="text-right font-medium">
              {money(report?.totals.result ?? 0)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Total activo
            </TableCell>
            <TableCell className="text-right font-medium">
              {money(report?.totals.assets ?? 0)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Total pasivo + patrimonio + resultado
            </TableCell>
            <TableCell className="text-right font-medium">
              {money(report?.totals.liabilitiesAndEquity ?? 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function IncomeStatementView({ report, loading }: { report?: IncomeStatement; loading: boolean }) {
  if (loading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Cuenta</TableHead>
            <TableHead className="text-right">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={3} className="font-medium">
              Ingresos
            </TableCell>
          </TableRow>
          <StatementRows lines={report?.revenue ?? []} />
          <TableRow>
            <TableCell colSpan={3} className="font-medium">
              Costos
            </TableCell>
          </TableRow>
          <StatementRows lines={report?.costs ?? []} />
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Utilidad bruta
            </TableCell>
            <TableCell className="text-right font-medium">
              {money(report?.totals.grossProfit ?? 0)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={3} className="font-medium">
              Gastos
            </TableCell>
          </TableRow>
          <StatementRows lines={report?.expenses ?? []} />
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Resultado del período
            </TableCell>
            <TableCell className="text-right font-medium">
              {money(report?.totals.result ?? 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
