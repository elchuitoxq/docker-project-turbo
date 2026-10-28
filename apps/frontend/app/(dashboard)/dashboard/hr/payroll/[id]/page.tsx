'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Banknote, BookOpen, Lock, Receipt } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePayroll, usePayPayroll, usePostPayroll } from '@/modules/hr/hooks';
import { hrApi, type ConceptCategory, type PayrollItem, type PayrollLine } from '@/modules/hr/api';
import { treasuryApi } from '@/modules/finance/api/treasury';
import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/use-auth-store';

const CATEGORY_LABEL: Record<ConceptCategory, string> = {
  ASSIGNMENT: 'Asignación',
  DEDUCTION: 'Deducción',
  EMPLOYER_CONTRIBUTION: 'Aporte patronal',
  INFORMATIVE: 'Informativo',
};

const CATEGORY_ICON: Record<ConceptCategory, string> = {
  ASSIGNMENT: '+',
  DEDUCTION: '−',
  EMPLOYER_CONTRIBUTION: '=',
  INFORMATIVE: 'i',
};

function money(value: number): string {
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function date(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' });
}

const FREQUENCY_LABEL: Record<string, string> = {
  MONTHLY: 'Mensual',
  BIWEEKLY: 'Quincenal',
  WEEKLY: 'Semanal',
};

function accumulate(lines: PayrollLine[], category: ConceptCategory): number {
  return lines
    .filter(line => line.category === category)
    .reduce((total, line) => total + line.amount, 0);
}

export default function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canProcess = permissions.includes(PERMISSIONS.HR.PAYROLL.PROCESS);

  const [selected, setSelected] = useState<PayrollItem | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const runQuery = usePayroll(id);
  const parametersQuery = useQuery({
    queryKey: ['hr', 'payroll', id, 'parameters'],
    queryFn: () => hrApi.getPayrollParameters(id),
  });
  const methodsQuery = useQuery({
    queryKey: ['treasury', 'methods'],
    queryFn: () => treasuryApi.listMethods(),
    enabled: canProcess,
  });
  const payPayroll = usePayPayroll();
  const postPayroll = usePostPayroll();

  const run = runQuery.data;
  const items = useMemo(() => run?.items ?? [], [run]);

  if (runQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!run) {
    return (
      <Card role="alert" className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Nómina no encontrada</CardTitle>
          <CardDescription>Revisa el enlace o vuelve al listado de nóminas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard/hr/payroll">
              <ArrowLeft data-icon="inline-start" />
              Volver
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const employerCost = items.reduce(
    (total, item) => total + accumulate(item.lines, 'EMPLOYER_CONTRIBUTION'),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link href="/dashboard/hr/payroll">
              <ArrowLeft data-icon="inline-start" />
              Nóminas
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Receipt className="text-muted-foreground" />
            {run.code}
          </h1>
          <p className="text-muted-foreground text-sm">
            {date(run.startDate)} — {date(run.endDate)} ·{' '}
            {FREQUENCY_LABEL[run.frequency] ?? run.frequency} · {items.length}{' '}
            {items.length === 1 ? 'empleado' : 'empleados'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={run.status === 'PAID' ? 'default' : 'secondary'}>{run.status}</Badge>
          {canProcess && run.status !== 'DRAFT' ? (
            <Button
              variant="outline"
              onClick={() =>
                postPayroll.mutate(run.id, {
                  onSuccess: entry =>
                    toast.success(
                      `Asiento ${entry.reference ?? entry.id} contabilizado por ${entry.lines.length} cuentas`
                    ),
                  onError: error =>
                    toast.error(
                      error instanceof Error ? error.message : 'No se pudo contabilizar la nómina'
                    ),
                })
              }
              disabled={postPayroll.isPending}
            >
              <BookOpen data-icon="inline-start" />
              {postPayroll.isPending ? 'Contabilizando…' : 'Contabilizar'}
            </Button>
          ) : null}
          {canProcess && run.status !== 'PAID' ? (
            <Button onClick={() => setPayOpen(true)}>
              <Banknote data-icon="inline-start" />
              Pagar nómina
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Neto a pagar</CardDescription>
            <CardTitle className="text-2xl">{money(run.totalAmount)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Deducciones</CardDescription>
            <CardTitle className="text-2xl">
              {money(items.reduce((total, item) => total + item.deductions, 0))}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Costo patronal (no afecta el neto)</CardDescription>
            <CardTitle className="text-2xl">{money(employerCost)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recibos por empleado</CardTitle>
          <CardDescription>
            Selecciona un empleado para ver el desglose por concepto con su base y tasa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Esta nómina no tiene empleados: la sucursal no tenía personal activo al generarla.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Sueldo del período</TableHead>
                  <TableHead className="text-right">Otros ingresos</TableHead>
                  <TableHead className="text-right">Deducciones</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.employeeName}</TableCell>
                    <TableCell className="text-right">{money(item.baseAmount)}</TableCell>
                    <TableCell className="text-right">{money(item.bonuses)}</TableCell>
                    <TableCell className="text-right">{money(item.deductions)}</TableCell>
                    <TableCell className="text-right font-medium">{money(item.netTotal)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(item)}>
                        Ver recibo
                      </Button>
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
            <Lock className="text-muted-foreground" />
            Parámetros congelados del período
          </CardTitle>
          <CardDescription>
            Copia tomada al generar la nómina. Cambiar un parámetro hoy no altera este documento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parametersQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (parametersQuery.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin parámetros congelados (nómina generada antes de la vigencia de parámetros).
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(parametersQuery.data ?? []).map(parameter => (
                <div
                  key={parameter.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground font-mono text-xs">{parameter.key}</span>
                  <span className="font-medium">
                    {parameter.type.startsWith('PERCENT')
                      ? `${parameter.value} %`
                      : money(parameter.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={open => (open ? null : setSelected(null))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recibo de {selected?.employeeName}</DialogTitle>
            <DialogDescription>
              Desglose por concepto con su base y la tasa efectiva aplicada.
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="flex flex-col gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Naturaleza</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Tasa</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.lines.map(line => (
                    <TableRow key={line.conceptCode}>
                      <TableCell>
                        <span className="font-mono text-xs">{line.conceptCode}</span>
                        <div className="text-muted-foreground text-xs">{line.conceptName}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            line.category === 'DEDUCTION'
                              ? 'secondary'
                              : line.category === 'INFORMATIVE'
                                ? 'outline'
                                : 'default'
                          }
                        >
                          {CATEGORY_ICON[line.category]} {CATEGORY_LABEL[line.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{money(line.base)}</TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs">
                        {line.rate && line.rate !== 1 ? `${(line.rate * 100).toFixed(4)} %` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">{money(line.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator />
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Asignaciones</span>
                  <span className="font-medium">
                    {money(accumulate(selected.lines, 'ASSIGNMENT'))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deducciones</span>
                  <span className="font-medium">
                    − {money(accumulate(selected.lines, 'DEDUCTION'))}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-semibold">Neto</span>
                  <span className="text-lg font-semibold">{money(selected.netTotal)}</span>
                </div>
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>Aporte patronal (costo del empleador)</span>
                  <span>{money(accumulate(selected.lines, 'EMPLOYER_CONTRIBUTION'))}</span>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar nómina {run.code}</DialogTitle>
            <DialogDescription>
              Se registra un único movimiento de tesorería por {money(run.totalAmount)}. Reintentar
              no duplica el pago.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const exchangeRate = String(form.get('exchangeRate') ?? '').trim();
              payPayroll.mutate(
                {
                  id,
                  body: {
                    methodId: String(form.get('methodId')),
                    exchangeRate: exchangeRate ? Number(exchangeRate) : undefined,
                    reference: String(form.get('reference') ?? '') || undefined,
                  },
                },
                {
                  onSuccess: result => {
                    toast.success(
                      result.alreadyPaid
                        ? `El pago ${result.paymentCode} ya existía`
                        : `Pago ${result.paymentCode} registrado`
                    );
                    setPayOpen(false);
                  },
                  onError: error =>
                    toast.error(
                      error instanceof Error ? error.message : 'No se pudo registrar el pago'
                    ),
                }
              );
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="methodId">Método de pago</FieldLabel>
                <Select name="methodId">
                  <SelectTrigger id="methodId">
                    <SelectValue placeholder="Selecciona un método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(methodsQuery.data ?? []).map(method => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Si el método afecta saldo, el monto se descuenta de la cuenta bancaria asociada.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="exchangeRate">Tasa manual (opcional)</FieldLabel>
                <Input id="exchangeRate" name="exchangeRate" type="number" step="0.00000001" />
                <FieldDescription>
                  Sólo si la moneda de la nómina no es la funcional. Sin tasa, se usa la del
                  período.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="reference">Referencia</FieldLabel>
                <Input id="reference" name="reference" defaultValue={run.code} />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={payPayroll.isPending}>
                {payPayroll.isPending ? 'Registrando…' : 'Pagar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
