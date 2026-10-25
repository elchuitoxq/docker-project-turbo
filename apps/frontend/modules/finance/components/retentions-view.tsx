'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Download, FileText, Calendar, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { retentionsApi, type Retention } from '../api/retentions';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_LABEL = {
  DRAFT: 'Borrador',
  APPLIED: 'Aplicada',
  PAID: 'Pagada',
  VOID: 'Anulada',
} as const;

const STATUS_VARIANT = {
  DRAFT: 'secondary',
  APPLIED: 'outline',
  PAID: 'default',
  VOID: 'destructive',
} as const;

export function RetentionsView() {
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<'ALL' | 'IVA' | 'ISLR'>('ALL');
  const [status, setStatus] = React.useState<string>('ALL');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['retentions', { type, status, fromDate, toDate }],
    queryFn: () =>
      retentionsApi.list({
        ...(type !== 'ALL' && { type }),
        ...(status !== 'ALL' && { status }),
        ...(fromDate && { fromDate }),
        ...(toDate && { toDate }),
      }),
  });

  const filtered = (data?.data ?? []).filter(
    (r) =>
      !search ||
      r.documentCode.toLowerCase().includes(search.toLowerCase()) ||
      (r.partnerName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const totalIva = filtered.filter((r) => r.type === 'IVA').reduce((acc, r) => acc + Number(r.retentionAmount), 0);
  const totalIslr = filtered.filter((r) => r.type === 'ISLR').reduce((acc, r) => acc + Number(r.retentionAmount), 0);

  function downloadTxt() {
    if (!fromDate || !toDate) {
      alert('Selecciona un rango de fechas para exportar');
      return;
    }
    retentionsApi
      .generateIvaTxt(fromDate, toDate)
      .then((res) => {
        const blob = new Blob([res.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename ?? 'ret-iva.txt';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('Error al generar TXT'));
  }

  function downloadXml() {
    if (!fromDate || !toDate) {
      alert('Selecciona un rango de fechas para exportar');
      return;
    }
    retentionsApi
      .generateIslrXml(fromDate, toDate)
      .then((res) => {
        const blob = new Blob([res.content], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename ?? 'ret-islr.xml';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('Error al generar XML'));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Retenciones</h1>
          <p className="text-sm text-muted-foreground">Retenciones IVA e ISLR</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTxt}>
            <FileText className="size-4" /> TXT IVA
          </Button>
          <Button variant="outline" onClick={downloadXml}>
            <FileSpreadsheet className="size-4" /> XML ISLR
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total IVA retenido</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalIva)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total ISLR retenido</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalIslr)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cantidad</p>
            <p className="text-2xl font-bold tabular-nums">{filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-8" />
            </div>
            <Select value={type} onValueChange={(v) => setType(v as 'ALL' | 'IVA' | 'ISLR')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="IVA">IVA</SelectItem>
                <SelectItem value="ISLR">ISLR</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Calendar className="size-4 text-muted-foreground" />
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
                placeholder="Desde"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
                placeholder="Hasta"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>{isLoading ? 'Cargando…' : `${filtered.length} retenciones`}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay retenciones</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="hidden md:table-cell">Factura</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Retenido</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: Retention) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.documentCode}</TableCell>
                    <TableCell className="text-xs">{formatDate(r.date)}</TableCell>
                    <TableCell>
                      <Badge variant={r.type === 'IVA' ? 'default' : 'secondary'}>{r.type}</Badge>
                    </TableCell>
                    <TableCell>{r.partnerName ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                      {r.invoiceCode ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(r.taxAmount))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {Number(r.retentionRate).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(Number(r.retentionAmount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
