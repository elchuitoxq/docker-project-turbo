'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, BadgeCheck, CalendarDays, HandCoins, PiggyBank } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  useBenefitsSummary,
  useDepositBenefit,
  useEmployee,
  useRegisterProfitSharing,
  useRegisterVacation,
  useSettlement,
  useSettleEmployee,
  useVacationSummary,
} from '@/modules/hr/hooks';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/use-auth-store';

const SETTLEMENT_CAUSES = [
  { value: 'RENUNCIA', label: 'Renuncia voluntaria' },
  { value: 'DESPIDO_JUSTIFICADO', label: 'Despido justificado' },
  { value: 'DESPIDO_INJUSTIFICADO', label: 'Despido injustificado (indemniza)' },
  { value: 'MUTUO_ACUERDO', label: 'Mutuo acuerdo' },
  { value: 'JUBILACION', label: 'Jubilación' },
  { value: 'MUERTE', label: 'Muerte' },
  { value: 'INCAPACIDAD', label: 'Incapacidad' },
];

function money(value: number): string {
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function date(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' });
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canSeePayroll = permissions.includes(PERMISSIONS.HR.PAYROLL.VIEW);
  const canProcess = permissions.includes(PERMISSIONS.HR.PAYROLL.PROCESS);

  const [vacationOpen, setVacationOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [profitOpen, setProfitOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);

  const employeeQuery = useEmployee(id);
  const vacationsQuery = useVacationSummary(canSeePayroll ? id : null);
  const benefitsQuery = useBenefitsSummary(canSeePayroll ? id : null);
  const settlementQuery = useSettlement(canSeePayroll ? id : null);

  const registerVacation = useRegisterVacation();
  const depositBenefit = useDepositBenefit();
  const registerProfit = useRegisterProfitSharing();
  const settle = useSettleEmployee();

  const employee = employeeQuery.data;
  const vacations = vacationsQuery.data;
  const benefits = benefitsQuery.data;
  const settlement = settlementQuery.data;

  if (employeeQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <Card role="alert" className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Empleado no encontrado</CardTitle>
          <CardDescription>Revisa el enlace o vuelve al listado de empleados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard/hr/employees">
              <ArrowLeft data-icon="inline-start" />
              Volver
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : 'No se pudo completar la operación');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link href="/dashboard/hr/employees">
              <ArrowLeft data-icon="inline-start" />
              Empleados
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-muted-foreground text-sm">
            {employee.identityCard} · {employee.positionName ?? 'Sin cargo'} ·{' '}
            {employee.departmentName ?? 'Sin departamento'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={employee.status === 'ACTIVE' ? 'default' : 'secondary'}>
            {employee.status}
          </Badge>
          <Badge variant="outline">Ingreso {date(employee.hireDate)}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>
              Sueldo mensual{employee.salaryCurrencyCode ? ` (${employee.salaryCurrencyCode})` : ''}
            </CardDescription>
            <CardTitle className="text-2xl">{money(employee.baseSalary)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Salario normal diario (moneda funcional)</CardDescription>
            <CardTitle className="text-2xl">
              {vacations ? money(vacations.normalDaily) : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Salario integral diario (moneda funcional)</CardDescription>
            <CardTitle className="text-2xl">
              {benefits ? money(benefits.integralDaily) : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {canSeePayroll ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="text-muted-foreground" />
                Vacaciones
              </CardTitle>
              <CardDescription>
                {vacations
                  ? `${vacations.years} años de servicio · ${vacations.vacationDays} días de vacaciones y ${vacations.bonusDays} de bono`
                  : 'Sin datos'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Días tomados</span>
                <span className="font-medium">{vacations?.daysTaken ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Días pendientes</span>
                <span className="font-medium">{vacations?.daysPending ?? 0}</span>
              </div>
              {canProcess ? (
                <Button variant="outline" onClick={() => setVacationOpen(true)}>
                  Registrar período vacacional
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="text-muted-foreground" />
                Prestaciones sociales
              </CardTitle>
              <CardDescription>
                Se paga la modalidad mayor entre garantía acumulada y retroactivo (Art. 142).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Garantía acumulada</span>
                <span className="font-medium">
                  {money(benefits?.guaranteeAccumulated ?? 0)} ({benefits?.quartersDeposited ?? 0}{' '}
                  trimestres)
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Retroactivo</span>
                <span className="font-medium">{money(benefits?.retroactive ?? 0)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Se paga</span>
                <span className="flex items-center gap-2 font-semibold">
                  {money(benefits?.payable ?? 0)}
                  <Badge variant={benefits?.modality === 'RETROACTIVE' ? 'secondary' : 'outline'}>
                    {benefits?.modality === 'RETROACTIVE' ? 'Retroactivo' : 'Garantía'}
                  </Badge>
                </span>
              </div>
              {canProcess ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => setDepositOpen(true)}>
                    Depositar trimestre
                  </Button>
                  <Button variant="outline" onClick={() => setProfitOpen(true)}>
                    Registrar utilidades
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="text-muted-foreground" />
            Liquidación de egreso
          </CardTitle>
          <CardDescription>
            Documento inmutable con prestaciones, vacaciones, bono, utilidades e indemnización.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {settlement ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Causa</span>
                  <span className="font-medium">{settlement.cause}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Egreso</span>
                  <span className="font-medium">{date(settlement.terminationDate)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prestaciones</span>
                  <span className="font-medium">{money(settlement.benefitsAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Vacaciones ({settlement.vacationDays} d) + bono ({settlement.bonusDays} d)
                  </span>
                  <span className="font-medium">
                    {money(settlement.vacationAmount + settlement.bonusAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Utilidades ({settlement.profitDays} d)
                  </span>
                  <span className="font-medium">{money(settlement.profitAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Indemnización ({settlement.indemnificationDays} d)
                  </span>
                  <span className="font-medium">{money(settlement.indemnificationAmount)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="flex items-center gap-2 text-xl font-semibold">
                  <BadgeCheck className="text-muted-foreground" />
                  {money(settlement.totalAmount)}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                Este empleado no tiene liquidación registrada.
              </p>
              {canProcess && employee.status !== 'TERMINATED' ? (
                <Button className="w-fit" onClick={() => setSettleOpen(true)}>
                  Liquidar egreso
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={vacationOpen} onOpenChange={setVacationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar vacaciones</DialogTitle>
            <DialogDescription>
              Se pagan los días indicados más el bono vacacional completo sobre el salario normal
              diario.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              registerVacation.mutate(
                {
                  employeeId: id,
                  body: {
                    year: Number(form.get('year')),
                    days: Number(form.get('days')),
                    startDate: String(form.get('startDate') ?? '') || undefined,
                  },
                },
                {
                  onSuccess: result => {
                    toast.success(
                      `Vacaciones registradas: ${money(result.vacationAmount)} + bono ${money(result.bonusAmount)}`
                    );
                    setVacationOpen(false);
                  },
                  onError,
                }
              );
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="year">Año</FieldLabel>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  defaultValue={new Date().getFullYear()}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="days">Días a tomar</FieldLabel>
                <Input
                  id="days"
                  name="days"
                  type="number"
                  max={vacations?.daysPending ?? undefined}
                  defaultValue={vacations?.daysPending ?? 1}
                  required
                />
                <FieldDescription>
                  Disponibles: {vacations?.daysPending ?? 0} de {vacations?.vacationDays ?? 0} días.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="startDate">Fecha de inicio</FieldLabel>
                <Input id="startDate" name="startDate" type="date" />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setVacationOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={registerVacation.isPending}>
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Depositar garantía trimestral</DialogTitle>
            <DialogDescription>
              15 días de salario integral por trimestre. El segundo depósito del mismo trimestre se
              rechaza.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              depositBenefit.mutate(
                {
                  employeeId: id,
                  body: {
                    year: Number(form.get('year')),
                    quarter: Number(form.get('quarter')),
                    isAnniversaryQuarter: form.get('isAnniversaryQuarter') === 'on',
                  },
                },
                {
                  onSuccess: result => {
                    toast.success(
                      `Garantía depositada. Acumulado: ${money(result.guaranteeAccumulated)}`
                    );
                    setDepositOpen(false);
                  },
                  onError,
                }
              );
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="year">Año</FieldLabel>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  defaultValue={new Date().getFullYear()}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="quarter">Trimestre</FieldLabel>
                <Select name="quarter" defaultValue="4">
                  <SelectTrigger id="quarter">
                    <SelectValue placeholder="Trimestre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="1">1º trimestre</SelectItem>
                      <SelectItem value="2">2º trimestre</SelectItem>
                      <SelectItem value="3">3º trimestre</SelectItem>
                      <SelectItem value="4">4º trimestre</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal">
                <Checkbox id="isAnniversaryQuarter" name="isAnniversaryQuarter" />
                <FieldLabel htmlFor="isAnniversaryQuarter">
                  En este trimestre se cumple el aniversario (suma días adicionales)
                </FieldLabel>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDepositOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={depositBenefit.isPending}>
                Depositar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={profitOpen} onOpenChange={setProfitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar utilidades</DialogTitle>
            <DialogDescription>
              Se pagan los días mínimos del ejercicio, proporcional a los meses trabajados y con el
              tope configurado.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              registerProfit.mutate(
                {
                  employeeId: id,
                  body: {
                    year: Number(form.get('year')),
                    monthsWorked: Number(form.get('monthsWorked')),
                  },
                },
                {
                  onSuccess: result => {
                    toast.success(`Utilidades: ${result.days} días · ${money(result.amount)}`);
                    setProfitOpen(false);
                  },
                  onError,
                }
              );
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="profitYear">Ejercicio</FieldLabel>
                <Input
                  id="profitYear"
                  name="year"
                  type="number"
                  defaultValue={new Date().getFullYear() - 1}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="monthsWorked">Meses trabajados</FieldLabel>
                <Input
                  id="monthsWorked"
                  name="monthsWorked"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={12}
                  required
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setProfitOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={registerProfit.isPending}>
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liquidar egreso</DialogTitle>
            <DialogDescription>
              Calcula prestaciones, vacaciones, bono, utilidades e indemnización, y marca al
              empleado como egresado. Un empleado se liquida una sola vez.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              settle.mutate(
                {
                  employeeId: id,
                  body: {
                    terminationDate: String(form.get('terminationDate')),
                    cause: String(form.get('cause')),
                  },
                },
                {
                  onSuccess: result => {
                    toast.success(`Liquidación registrada: ${money(result.totalAmount)}`);
                    setSettleOpen(false);
                  },
                  onError,
                }
              );
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="terminationDate">Fecha de egreso</FieldLabel>
                <Input
                  id="terminationDate"
                  name="terminationDate"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cause">Causa</FieldLabel>
                <Select name="cause" defaultValue="RENUNCIA">
                  <SelectTrigger id="cause">
                    <SelectValue placeholder="Causa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SETTLEMENT_CAUSES.map(cause => (
                        <SelectItem key={cause.value} value={cause.value}>
                          {cause.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Sólo el despido injustificado genera indemnización (Art. 92 LOTTT).
                </FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setSettleOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={settle.isPending}>
                Confirmar liquidación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
