'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download, History, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
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
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import {
  RESULT_LABELS,
  MODULE_LABELS,
  ACTION_SHORT,
  auditApi,
  type AuditFilters,
  type AuditLog,
} from '../api';
import { AuditDetailSheet } from './audit-detail-sheet';

const PAGE_SIZE = 25;

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  VOID: 'destructive',
  LOGIN_FAILED: 'destructive',
  DENIED: 'destructive',
  POST: 'outline',
  LOGIN: 'outline',
};

type Preset = 'today' | 'yesterday' | 'week' | 'month';

function dayToIso(day: string, end = false): string {
  return new Date(`${day}T${end ? '23:59:59.999' : '00:00:00.000'}`).toISOString();
}

function localDay(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function presetRange(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const to = localDay(today);

  if (preset === 'today') return { from: to, to };
  if (preset === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const day = localDay(yesterday);
    return { from: day, to: day };
  }
  if (preset === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { from: localDay(start), to };
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: localDay(start), to };
}

function readFilters(params: URLSearchParams): AuditFilters {
  const pick = (key: string) => params.get(key) ?? undefined;
  return {
    q: pick('q'),
    module: pick('module'),
    action: pick('action'),
    result: pick('result'),
    userId: pick('userId'),
    from: pick('from'),
    to: pick('to'),
  };
}

/**
 * Visor de auditoría (`T-07-04`).
 *
 * Una sola barra para buscar (documento, usuario, resumen) y filtros con conteo: se puede llegar al
 * hecho desde el código del documento o desde la persona que lo hizo. La fila abre la ficha con el
 * antes/después de cada campo.
 */
export function AuditView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission } = usePermission();
  const canExport = hasPermission(PERMISSIONS.SETTINGS.AUDIT.EXPORT);

  const [filters, setFilters] = React.useState<AuditFilters>(() =>
    readFilters(new URLSearchParams(searchParams.toString()))
  );
  const [search, setSearch] = React.useState(() => searchParams.get('q') ?? '');
  const [page, setPage] = React.useState(() => Number(searchParams.get('page') ?? 1));
  const [selected, setSelected] = React.useState<AuditLog | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const writtenQuery = React.useRef(searchParams.toString());

  // El buscador espera a que el usuario deje de teclear: sin esto cada letra es una consulta.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(previous => (previous.q === search ? previous : { ...previous, q: search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Filtros en la dirección: la búsqueda se puede compartir o recargar sin perderla.
  React.useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    if (page > 1) params.set('page', String(page));

    const query = params.toString();
    if (query === writtenQuery.current) return;
    writtenQuery.current = query;
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, page, pathname, router]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement !== searchRef.current) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const facets = useQuery({
    queryKey: ['audit', 'facets'],
    queryFn: auditApi.facets,
    staleTime: 60_000,
  });

  const logs = useQuery({
    queryKey: ['audit', filters, page],
    queryFn: () => auditApi.list(filters, page, PAGE_SIZE),
  });

  const total = logs.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const update = (patch: Partial<AuditFilters>) => {
    setFilters(previous => ({ ...previous, ...patch }));
    setPage(1);
  };

  const clearAll = () => {
    setSearch('');
    setFilters({});
    setPage(1);
  };

  const applyPreset = (preset: Preset) => {
    const { from, to } = presetRange(preset);
    update({ from: dayToIso(from), to: dayToIso(to, true) });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = await auditApi.exportCsv(filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const activeChips = buildChips(
    filters,
    facets.data,
    value => update(value),
    () => {
      setSearch('');
      update({ q: undefined });
    }
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
          <p className="text-sm text-muted-foreground">
            Quién hizo qué y cuándo, con la hora exacta y el antes y el después de cada campo
          </p>
        </div>
        {canExport && (
          <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting}>
            <Download className="mr-2 size-4" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar por documento, usuario, correo o acción (FAC-000123, Ana…)"
                className="pl-8"
                aria-label="Buscar en la bitácora"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => applyPreset('today')}>
                Hoy
              </Button>
              <Button variant="ghost" size="sm" onClick={() => applyPreset('yesterday')}>
                Ayer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => applyPreset('week')}>
                7 días
              </Button>
              <Button variant="ghost" size="sm" onClick={() => applyPreset('month')}>
                Este mes
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filters.userId ?? 'ALL'}
                onValueChange={value => update({ userId: value === 'ALL' ? undefined : value })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los usuarios</SelectItem>
                  {(facets.data?.actors ?? []).map(actor => (
                    <SelectItem key={actor.userId ?? 'system'} value={actor.userId ?? 'system'}>
                      {actor.name} ({actor.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.module ?? 'ALL'}
                onValueChange={value => update({ module: value === 'ALL' ? undefined : value })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los módulos</SelectItem>
                  {(facets.data?.modules ?? []).map(module => (
                    <SelectItem key={module.value} value={module.value}>
                      {MODULE_LABELS[module.value] ?? module.label} ({module.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.action ?? 'ALL'}
                onValueChange={value => update({ action: value === 'ALL' ? undefined : value })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las acciones</SelectItem>
                  {(facets.data?.actions ?? []).map(action => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label} ({action.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.result ?? 'ALL'}
                onValueChange={value => update({ result: value === 'ALL' ? undefined : value })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Resultado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {Object.entries(RESULT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <DatePicker
                value={filters.from ? filters.from.slice(0, 10) : ''}
                onChange={value => update({ from: value ? dayToIso(value) : undefined })}
                placeholder="Desde"
                className="w-40"
                clearable
                toDate={filters.to ? filters.to.slice(0, 10) : undefined}
                aria-label="Desde"
              />
              <DatePicker
                value={filters.to ? filters.to.slice(0, 10) : ''}
                onChange={value => update({ to: value ? dayToIso(value, true) : undefined })}
                placeholder="Hasta"
                className="w-40"
                clearable
                fromDate={filters.from ? filters.from.slice(0, 10) : undefined}
                aria-label="Hasta"
              />
            </div>

            {activeChips.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Limpiar
              </Button>
            )}
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeChips.map(chip => (
                <Badge key={chip.key} variant="secondary" className="gap-1 font-normal">
                  {chip.label}
                  <button
                    type="button"
                    aria-label={`Quitar filtro ${chip.label}`}
                    onClick={chip.clear}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" /> {total} registros
          </CardTitle>
          <CardDescription>
            Página {page} de {pages}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logs.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.isError ? (
            <p className="p-6 text-center text-sm text-destructive">
              No se pudo cargar la bitácora. Vuelve a intentarlo.
            </p>
          ) : (logs.data?.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-1 p-8 text-center">
              <p className="text-sm font-medium">No hay registros con estos filtros</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otro código, amplía las fechas o limpia los filtros.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs.data?.data ?? []).map(log => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(log)}
                  >
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="block max-w-32 truncate">{log.actorName ?? 'Sistema'}</span>
                      <span className="block max-w-32 truncate text-muted-foreground">
                        {log.actorEmail ?? ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ACTION_VARIANT[log.action] ?? 'secondary'}
                        className="whitespace-nowrap"
                      >
                        {ACTION_SHORT[log.action] ?? log.actionLabel ?? log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-xs" title={log.description ?? ''}>
                      {log.description ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.documentCode ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={log.result === 'SUCCESS' ? 'outline' : 'destructive'}
                        className="whitespace-nowrap"
                      >
                        {RESULT_LABELS[log.result ?? ''] ?? log.result ?? '—'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} registros · página {page} de {pages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(current => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(current => current + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <AuditDetailSheet
        log={selected}
        onClose={() => setSelected(null)}
        onFilterDocument={code => {
          setSearch(code);
          setSelected(null);
        }}
      />
    </div>
  );
}

function buildChips(
  filters: AuditFilters,
  facets: Awaited<ReturnType<typeof auditApi.facets>> | undefined,
  update: (patch: Partial<AuditFilters>) => void,
  clearSearch: () => void
) {
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];

  if (filters.q) {
    chips.push({ key: 'q', label: `“${filters.q}”`, clear: clearSearch });
  }
  if (filters.userId) {
    const actor = facets?.actors.find(item => item.userId === filters.userId);
    chips.push({
      key: 'userId',
      label: actor?.name ?? 'Usuario',
      clear: () => update({ userId: undefined }),
    });
  }
  if (filters.module) {
    chips.push({
      key: 'module',
      label: MODULE_LABELS[filters.module] ?? filters.module,
      clear: () => update({ module: undefined }),
    });
  }
  if (filters.action) {
    const action = facets?.actions.find(item => item.value === filters.action);
    chips.push({
      key: 'action',
      label: action?.label ?? filters.action,
      clear: () => update({ action: undefined }),
    });
  }
  if (filters.result) {
    chips.push({
      key: 'result',
      label: RESULT_LABELS[filters.result] ?? filters.result,
      clear: () => update({ result: undefined }),
    });
  }
  if (filters.from) {
    chips.push({
      key: 'from',
      label: `Desde ${filters.from.slice(0, 10)}`,
      clear: () => update({ from: undefined }),
    });
  }
  if (filters.to) {
    chips.push({
      key: 'to',
      label: `Hasta ${filters.to.slice(0, 10)}`,
      clear: () => update({ to: undefined }),
    });
  }

  return chips;
}
