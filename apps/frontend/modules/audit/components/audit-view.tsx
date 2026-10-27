'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, History, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { auditApi, diffRows, type AuditLog } from '../api';
import { formatDate } from '@/lib/utils';

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  VOID: 'destructive',
  POST: 'outline',
};

const PAGE_SIZE = 25;

/**
 * Visor de auditoría (`T-07-04`).
 *
 * Filtra por tabla, acción, documento y rango de fechas, y expande el diff campo por campo en vez de
 * mostrar el JSON crudo del registro.
 */
export function AuditView() {
  const [entityTable, setEntityTable] = React.useState('ALL');
  const [action, setAction] = React.useState('ALL');
  const [documentCode, setDocumentCode] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const tables = useQuery({ queryKey: ['audit', 'entities'], queryFn: auditApi.entityTables });

  const logs = useQuery({
    queryKey: ['audit', { entityTable, action, documentCode, from, to, page }],
    queryFn: () =>
      auditApi.list(
        {
          ...(entityTable !== 'ALL' ? { entityTable } : {}),
          ...(action !== 'ALL' ? { action } : {}),
          ...(documentCode ? { documentCode } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
        page,
        PAGE_SIZE
      ),
  });

  const total = logs.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Quién cambió qué y cuándo, con el antes y el después de cada campo
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-3 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={documentCode}
              onChange={event => {
                setDocumentCode(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por documento (A-90006, PAY-00009…)"
              className="pl-8"
            />
          </div>
          <Select
            value={entityTable}
            onValueChange={value => {
              setEntityTable(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Tabla" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las tablas</SelectItem>
              {(tables.data ?? []).map(table => (
                <SelectItem key={table} value={table}>
                  {table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={action}
            onValueChange={value => {
              setAction(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              <SelectItem value="CREATE">Alta</SelectItem>
              <SelectItem value="UPDATE">Cambio</SelectItem>
              <SelectItem value="POST">Publicación</SelectItem>
              <SelectItem value="VOID">Anulación</SelectItem>
              <SelectItem value="DELETE">Borrado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={event => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="w-40"
          />
          <Input
            type="date"
            value={to}
            onChange={event => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
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
          ) : (logs.data?.data ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay registros de auditoría con estos filtros.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Tabla</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs.data?.data ?? []).map(log => (
                  <LogRow
                    key={log.id}
                    log={log}
                    expanded={expanded === log.id}
                    onToggle={() => setExpanded(expanded === log.id ? null : log.id)}
                  />
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
    </div>
  );
}

function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rows = diffRows(log.changes);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          {rows.length > 0 ? (
            expanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )
          ) : null}
        </TableCell>
        <TableCell className="text-xs">{log.createdAt ? formatDate(log.createdAt) : '—'}</TableCell>
        <TableCell>
          <Badge variant={ACTION_VARIANT[log.action] ?? 'secondary'}>{log.action}</Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{log.entityTable}</TableCell>
        <TableCell className="font-mono text-xs">{log.documentCode ?? '—'}</TableCell>
        <TableCell className="text-xs">{log.description ?? '—'}</TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {log.userId ? log.userId.slice(0, 8) : 'sistema'}
        </TableCell>
      </TableRow>

      {expanded && rows.length > 0 && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/40">
            <div className="flex flex-col gap-1 py-2">
              {rows.map(row => (
                <div key={row.field} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="w-32 font-medium">{row.field}</span>
                  <span className="text-destructive line-through">{row.before}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-emerald-600">{row.after}</span>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
