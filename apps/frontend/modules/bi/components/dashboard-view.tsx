'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  Package,
  Wallet,
  AlertCircle,
  Activity as ActivityIcon,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { biApi, type KpiCard, type ChartPoint, type ActivityItem } from '../api';
import { formatCurrency, formatDate } from '@/lib/utils';

const ICON_MAP = {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  Package,
  Wallet,
  AlertCircle,
};

const VARIANT_COLOR: Record<KpiCard['variant'], string> = {
  default: 'text-primary',
  warning: 'text-amber-600',
  success: 'text-emerald-600',
  destructive: 'text-destructive',
};

export function DashboardView() {
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['bi', 'kpis'],
    queryFn: () => biApi.kpis(),
  });
  const { data: chart, isLoading: loadingChart } = useQuery({
    queryKey: ['bi', 'chart'],
    queryFn: () => biApi.chart(),
  });
  const { data: activity, isLoading: loadingActivity } = useQuery({
    queryKey: ['bi', 'activity'],
    queryFn: () => biApi.activity({ limit: 20 }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
          <p className="text-sm text-muted-foreground">Resumen de actividad y KPIs</p>
        </div>
        <Badge variant="outline" className="self-start sm:self-auto">
          Actualizado en tiempo real
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loadingKpis
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : (kpis ?? []).slice(0, 8).map(kpi => <KpiCardView key={kpi.id} kpi={kpi} />)}
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ingresos vs Egresos</CardTitle>
            <CardDescription>Últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChart ? <Skeleton className="h-64" /> : <ChartView data={chart ?? []} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon className="size-4" /> Actividad reciente
            </CardTitle>
            <CardDescription>Últimos eventos del sistema</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingActivity ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : (activity ?? []).length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Sin actividad</div>
            ) : (
              <div className="divide-y">
                {(activity ?? []).map(item => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCardView({ kpi }: { kpi: KpiCard }) {
  const Icon = ICON_MAP[kpi.icon as keyof typeof ICON_MAP] ?? DollarSign;
  const isPositive = kpi.change >= 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{kpi.title}</p>
          <Icon className={`size-4 ${VARIANT_COLOR[kpi.variant]}`} />
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{kpi.formatted}</p>
        <div className="mt-1 flex items-center gap-1 text-xs">
          {isPositive ? (
            <ArrowUpRight className="size-3 text-emerald-600" />
          ) : (
            <ArrowDownRight className="size-3 text-destructive" />
          )}
          <span className={isPositive ? 'text-emerald-600' : 'text-destructive'}>
            {isPositive ? '+' : ''}
            {kpi.change.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">{kpi.changeLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartView({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin datos
      </div>
    );
  }
  const max = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
  const width = 600;
  const height = 240;
  const padding = 24;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const xStep = innerW / Math.max(1, data.length - 1);

  const incomePath = data
    .map(
      (d, i) =>
        `${i === 0 ? 'M' : 'L'}${padding + i * xStep},${padding + innerH - (d.income / max) * innerH}`
    )
    .join(' ');
  const expensePath = data
    .map(
      (d, i) =>
        `${i === 0 ? 'M' : 'L'}${padding + i * xStep},${padding + innerH - (d.expense / max) * innerH}`
    )
    .join(' ');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span>Ingresos</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-destructive" />
          <span>Egresos</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        <defs>
          <linearGradient id="income-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="expense-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(239 68 68)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(239 68 68)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${incomePath} L${padding + (data.length - 1) * xStep},${padding + innerH} L${padding},${padding + innerH} Z`}
          fill="url(#income-gradient)"
        />
        <path
          d={`${expensePath} L${padding + (data.length - 1) * xStep},${padding + innerH} L${padding},${padding + innerH} Z`}
          fill="url(#expense-gradient)"
        />
        <path d={incomePath} fill="none" stroke="rgb(16 185 129)" strokeWidth="2" />
        <path d={expensePath} fill="none" stroke="rgb(239 68 68)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const isIncome = item.type === 'INVOICE' || item.type === 'PAYMENT';
  return (
    <div className="flex items-start gap-3 p-3">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isIncome ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
        }`}
      >
        <FileText className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.userName && `${item.userName} · `}
          {formatDate(item.timestamp)}
        </p>
      </div>
    </div>
  );
}
