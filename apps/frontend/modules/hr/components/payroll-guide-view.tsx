'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  BookOpen,
  Calculator,
  ChevronRight,
  CircleAlert,
  GraduationCap,
  Landmark,
  Settings2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { hrApi } from '@/modules/hr/api';
import { usePayrollSettings } from '@/modules/hr/hooks';
import { formatCurrency } from '@/lib/utils';
import {
  GUIDE_ITEMS,
  computeIslr,
  guideProgress,
  itemStatus,
  type GuideConfidence,
  type GuideStatus,
  type IncomeTaxBracket,
} from '@/lib/payroll-guide';

const STATUS_LABEL: Record<GuideStatus, string> = {
  configurado: 'Configurado',
  revisar: 'Revisar',
  pendiente: 'Pendiente',
};

const STATUS_VARIANT: Record<GuideStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  configurado: 'default',
  revisar: 'outline',
  pendiente: 'destructive',
};

const CONFIDENCE_LABEL: Record<GuideConfidence, string> = {
  alta: 'Fuente verificada',
  media: 'Fuente parcial',
  baja: 'Requiere validación legal',
};

const CONFIDENCE_VARIANT: Record<GuideConfidence, 'default' | 'secondary' | 'destructive'> = {
  alta: 'default',
  media: 'secondary',
  baja: 'destructive',
};

const KEY_LABELS: Record<string, string> = {
  SSO_EMP: 'Seguro social trabajador',
  SSO_PAT: 'Seguro social patrono',
  TOPE_SSO: 'Tope seguro social',
  PIE_EMP: 'Paro forzoso trabajador',
  PIE_PAT: 'Paro forzoso patrono',
  TOPE_PARO: 'Tope paro forzoso',
  FAOV_EMP: 'FAOV trabajador',
  FAOV_PAT: 'FAOV patrono',
  TOPE_FAOV: 'Tope FAOV',
  CESTATICKET_USD: 'Cestaticket mensual (USD)',
  DIAS_UTILIDADES: 'Días de utilidades',
  TOPE_UTILIDADES_MESES: 'Tope de utilidades (meses)',
  DIAS_VACACIONES_BASE: 'Días de vacaciones',
  DIAS_BONO_VACACIONAL: 'Días de bono vacacional',
  TOPE_DIAS_VACACIONES_EXTRA: 'Tope de días adicionales',
  UNIDAD_TRIBUTARIA: 'Unidad tributaria (Bs)',
  ISLR_DESCUENTO_UNICO: 'Descuento único anual (Bs)',
};

function formatSettingValue(key: string, value: number): string {
  if (key.endsWith('_EMP') || key.endsWith('_PAT')) return `${formatPercent(value)} %`;
  if (key === 'CESTATICKET_USD') return formatCurrency(value, 'USD');
  if (key === 'UNIDAD_TRIBUTARIA' || key === 'ISLR_DESCUENTO_UNICO')
    return formatCurrency(value, 'VES');
  return new Intl.NumberFormat('es-VE').format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(value);
}

/**
 * Guía interactiva de parámetros legales (`P-28`).
 *
 * No es un formulario: es el recorrido que explica **qué pide la ley**, **cómo lo resuelve SAP** y
 * **qué hay que decidir**, con el estado real de cada parámetro y una simulación para ver el efecto
 * antes de tocar nada.
 */
export function PayrollGuideView() {
  const settings = usePayrollSettings();
  const incomeTax = useQuery({
    queryKey: ['hr', 'income-tax-table'],
    queryFn: () => hrApi.getIncomeTaxTable(),
  });

  const values = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const setting of settings.data ?? []) map[setting.key] = setting.value;
    return map;
  }, [settings.data]);

  const progress = guideProgress(GUIDE_ITEMS, values);

  if (settings.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <GraduationCap className="size-6" />
            Guía de parámetros legales
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Qué pide la ley, cómo lo resuelve un ERP como SAP y qué tiene que decidir la empresa.
            Los valores marcados como «requiere validación legal» deben confirmarse con un contador
            o abogado laboral antes de facturar en producción.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/settings/payroll-settings">
            <Settings2 data-icon="inline-start" />
            Editar parámetros
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avance de la configuración</CardTitle>
          <CardDescription>
            {progress.configured} de {progress.total} bloques con todos sus parámetros cargados
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress value={progress.percent} />
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="default">{progress.configured} configurados</Badge>
            <Badge variant="outline">{progress.review} a revisar</Badge>
            <Badge variant="destructive">{progress.pending} pendientes</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-3">
          {GUIDE_ITEMS.map(item => {
            const status = itemStatus(item, values);

            return (
              <Card key={item.id} data-testid={`guide-${item.id}`}>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Landmark className="size-4 text-muted-foreground" />
                      {item.id === 'islr'
                        ? 'ISLR (impuesto sobre la renta)'
                        : item.id.toUpperCase()}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={CONFIDENCE_VARIANT[item.confidence]}>
                        {CONFIDENCE_LABEL[item.confidence]}
                      </Badge>
                      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                    </div>
                  </div>
                  <CardDescription>{item.summary}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Cómo lo resuelve SAP
                      </p>
                      <p className="text-xs leading-relaxed">{item.sap}</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Lo que dice la norma
                      </p>
                      <p className="text-xs leading-relaxed">{item.legal}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Parámetros en el ERP
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.keys.map(key => (
                        <span
                          key={key}
                          className="rounded-md border px-2 py-1 text-xs tabular-nums"
                          data-testid={`value-${key}`}
                        >
                          {KEY_LABELS[key] ?? key}:{' '}
                          {values[key] === undefined ? '—' : formatSettingValue(key, values[key])}
                        </span>
                      ))}
                    </div>
                  </div>

                  {item.id === 'islr' && (
                    <div className="rounded-md border p-3">
                      <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Calculator className="size-3.5" />
                        Tarifa vigente ({incomeTax.data?.brackets.length ?? 0} tramos · UT{' '}
                        {incomeTax.data ? formatCurrency(incomeTax.data.utValue, 'VES') : '—'})
                      </p>
                      <div className="grid gap-1 text-xs sm:grid-cols-2">
                        {(incomeTax.data?.brackets ?? []).map(bracket => (
                          <span key={bracket.fromUt} className="tabular-nums">
                            {bracket.fromUt}–{bracket.toUt === null ? '∞' : bracket.toUt} UT ·{' '}
                            {(bracket.rate * 100).toFixed(0)} % − {bracket.discountUt} UT
                          </span>
                        ))}
                      </div>
                      {incomeTax.data?.brackets.length === 0 && (
                        <p className="text-xs text-destructive">
                          No hay tramos cargados: la nómina no se podrá generar (RN-09).
                        </p>
                      )}
                    </div>
                  )}

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Qué hay que decidir
                      </p>
                      <p className="text-xs leading-relaxed">{item.decision}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Cómo se comprueba
                      </p>
                      <p className="text-xs leading-relaxed">{item.check}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <PayrollSimulator values={values} brackets={incomeTax.data?.brackets ?? []} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4" />
                Cómo leer esta guía
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <span>
                  <strong>Configurado</strong>: todos los parámetros tienen valor.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                <span>
                  <strong>Revisar</strong>: falta algún valor o la fuente legal no está confirmada.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <ChevronRight className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Cada bloque es independiente: se puede configurar en cualquier orden, pero la
                  nómina no debe usarse en producción con bloques en rojo.
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PayrollSimulator({
  values,
  brackets,
}: {
  values: Record<string, number>;
  brackets: IncomeTaxBracket[];
}) {
  const [salary, setSalary] = React.useState('10000');
  const monthly = Number(salary) || 0;

  const ivssBase = Math.min(monthly, values.TOPE_SSO ?? monthly);
  const pieBase = Math.min(monthly, values.TOPE_PARO ?? monthly);
  const faovBase = monthly;

  const ivss = (ivssBase * (values.SSO_EMP ?? 0)) / 100;
  const pie = (pieBase * (values.PIE_EMP ?? 0)) / 100;
  const faov = (faovBase * (values.FAOV_EMP ?? 0)) / 100;
  const islr = computeIslr(monthly * 12, brackets, values.UNIDAD_TRIBUTARIA ?? 0);
  const net = monthly - ivss - pie - faov - islr;

  const rows = [
    { label: 'Sueldo del mes', value: monthly, negative: false },
    {
      label: `Seguro social (${formatPercent(values.SSO_EMP ?? 0)} %)`,
      value: -ivss,
      negative: true,
    },
    {
      label: `Paro forzoso (${formatPercent(values.PIE_EMP ?? 0)} %)`,
      value: -pie,
      negative: true,
    },
    { label: `FAOV (${formatPercent(values.FAOV_EMP ?? 0)} %)`, value: -faov, negative: true },
    { label: 'ISLR estimado del mes', value: -islr, negative: true },
  ];

  return (
    <Card data-testid="payroll-simulator">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="size-4" />
          Simulador
        </CardTitle>
        <CardDescription>
          Aplica los parámetros vigentes a un sueldo mensual. Sirve para ver el efecto antes de
          cambiar nada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sim-salary">Sueldo mensual (Bs)</FieldLabel>
            <Input
              id="sim-salary"
              type="number"
              min={0}
              value={salary}
              onChange={event => setSalary(event.target.value)}
            />
          </Field>
        </FieldGroup>

        <div className="flex flex-col gap-1 text-sm">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{row.label}</span>
              <span className={row.negative ? 'tabular-nums text-destructive' : 'tabular-nums'}>
                {row.negative ? '−' : ''}
                {formatCurrency(Math.abs(row.value), 'VES')}
              </span>
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex items-center justify-between gap-2 font-medium">
            <span>Neto estimado</span>
            <span className="tabular-nums">{formatCurrency(net, 'VES')}</span>
          </div>
        </div>

        <p className="text-[11px] leading-snug text-muted-foreground">
          Estimación con la tabla vigente y el descuento único configurado. No incluye desgravámenes
          ni otros conceptos del recibo.
        </p>
      </CardContent>
    </Card>
  );
}
