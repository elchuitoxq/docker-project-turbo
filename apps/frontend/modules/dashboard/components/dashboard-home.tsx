'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Wallet, Users, Banknote, FileMinus, ArrowRight, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { biApi, type MonthlyData } from '../api';
import { formatCurrency, formatDay } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Emitida',
  PAID: 'Pagada',
  PARTIAL: 'Abonada',
  VOID: 'Anulada',
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
};

/**
 * Panel de inicio (`T-07-05`).
 *
 * Cuatro KPIs reales de `/bi/kpis`, la evolución mensual de ventas y cobros de `/bi/chart` y la
 * actividad reciente de `/bi/activity`. Todo respeta la sucursal activa porque el cliente HTTP
 * envía `x-branch-id`.
 */
export function DashboardHome() {
  const year = new Date().getFullYear();
  const [chartType, setChartType] = React.useState<'sales' | 'payments'>('sales');

  const kpis = useQuery({ queryKey: ['bi', 'kpis'], queryFn: biApi.kpis });
  const chart = useQuery({
    queryKey: ['bi', 'chart', chartType, year],
    queryFn: () => biApi.chart(chartType, year),
  });
  const activity = useQuery({ queryKey: ['bi', 'activity'], queryFn: biApi.activity });

  const data = kpis.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
        <p className="text-sm text-muted-foreground">
          Actividad de la sucursal: facturación, cobros, personal y nómina
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Facturación emitida"
          value={data ? formatCurrency(Number(data.totalInvoicesPosted.sum)) : null}
          hint={data ? `${data.totalInvoicesPosted.count} documentos` : undefined}
          icon={<Receipt className="size-4 text-muted-foreground" />}
          href="/dashboard/finance/invoices"
        />
        <KpiCard
          label="Cobros y pagos"
          value={data ? formatCurrency(Number(data.totalPaymentsPosted.sum)) : null}
          hint={data ? `${data.totalPaymentsPosted.count} movimientos` : undefined}
          icon={<Wallet className="size-4 text-muted-foreground" />}
          href="/dashboard/finance/treasury"
        />
        <KpiCard
          label="Empleados activos"
          value={data ? String(data.totalEmployees.count) : null}
          hint="Plantilla registrada"
          icon={<Users className="size-4 text-muted-foreground" />}
          href="/dashboard/hr/employees"
        />
        <KpiCard
          label="Nóminas pendientes"
          value={data ? String(data.pendingPayrollRuns.count) : null}
          hint={data ? `${data.totalCreditNotes.count} notas de crédito` : undefined}
          icon={<Banknote className="size-4 text-muted-foreground" />}
          href="/dashboard/hr/payroll"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <TrendingUp className="size-4" /> Evolución {year}
              </span>
              <Select
                value={chartType}
                onValueChange={value => setChartType(value as 'sales' | 'payments')}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Ventas</SelectItem>
                  <SelectItem value="payments">Cobros</SelectItem>
                </SelectContent>
              </Select>
            </CardTitle>
            <CardDescription>Total por mes en moneda funcional</CardDescription>
          </CardHeader>
          <CardContent>
            {chart.isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <MonthlyBars data={chart.data ?? []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            <CardDescription>Últimas facturas y pagos registrados</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {activity.isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...(activity.data?.recentInvoices ?? []).map(row => ({
                      code: row.code,
                      partner: row.partnerName,
                      amount: row.total,
                      status: row.status,
                      date: row.date,
                    })),
                    ...(activity.data?.recentPayments ?? []).map(row => ({
                      code: row.code,
                      partner: row.partnerName,
                      amount: row.amount,
                      status: row.status,
                      date: row.date,
                    })),
                  ]
                    .slice(0, 8)
                    .map(row => (
                      <TableRow key={row.code}>
                        <TableCell className="font-mono text-xs">{row.code}</TableCell>
                        <TableCell className="text-xs">{row.partner ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(Number(row.amount ?? 0))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {row.status ? (STATUS_LABEL[row.status] ?? row.status) : '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.date ? formatDay(row.date.slice(0, 10)) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  {(activity.data?.recentInvoices ?? []).length === 0 &&
                    (activity.data?.recentPayments ?? []).length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-sm text-muted-foreground"
                        >
                          Sin actividad todavía
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string | null;
  hint?: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          {value === null ? <Skeleton className="h-7 w-24" /> : value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        <Button asChild variant="ghost" size="sm" className="mt-2 -ml-2">
          <Link href={href}>
            Ver detalle
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MonthlyBars({ data }: { data: MonthlyData[] }) {
  const max = Math.max(1, ...data.map(row => Number(row.total ?? 0)));

  return (
    <div className="flex h-44 items-end gap-1">
      {data.map(row => {
        const height = Math.round((Number(row.total ?? 0) / max) * 100);

        return (
          <div key={row.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end">
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${row.monthName}: ${formatCurrency(Number(row.total ?? 0))}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{row.monthName.slice(0, 3)}</span>
          </div>
        );
      })}
    </div>
  );
}
