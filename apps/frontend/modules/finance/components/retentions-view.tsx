'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Calendar, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { retentionsApi } from '../api/retentions';
import { formatMoney, formatDate } from '@/lib/utils';
import { useCurrencyIndex } from '@/lib/currency';

/**
 * Retenciones IVA/ISLR emitidas (`S-06`).
 *
 * Los comprobantes los genera el sistema al registrar el pago de una factura de compra
 * (`tax_retentions`); esta pantalla los lista con su factura de origen y exporta los archivos del
 * SENIAT. Antes pedía `/accounting/retentions`, una ruta que no existe (`S-16` M-14).
 */
export function RetentionsView() {
  const { baseCode, codeOf } = useCurrencyIndex();
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<'ALL' | 'IVA' | 'ISLR'>('ALL');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  /**
   * Base e IVA del comprobante están en la moneda del documento; el retenido se muestra convertido a
   * moneda funcional. Etiquetar la base de una compra en USD como Bs.S era un error de lectura fiscal
   * (`S-16` M-25).
   */
  const rowCurrency = (row: { currencyId?: string | null }) => codeOf(row.currencyId);

  const { data, isLoading } = useQuery({
    queryKey: ['retentions', { type, fromDate, toDate }],
    queryFn: () =>
      retentionsApi.list({
        ...(type !== 'ALL' && { type }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      }),
  });

  const rows = data ?? [];
  const filtered = rows.filter(row => {
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      row.code.toLowerCase().includes(needle) ||
      (row.partnerName ?? '').toLowerCase().includes(needle) ||
      (row.invoiceCode ?? '').toLowerCase().includes(needle)
    );
  });

  const sumRetained = (wanted: 'IVA' | 'ISLR') =>
    filtered
      .filter(row => row.type === wanted)
      .reduce((acc, row) => acc + Number(row.totalRetainedBase ?? row.totalRetained), 0);

  const totalIva = sumRetained('IVA');
  const totalIslr = sumRetained('ISLR');

  function downloadTxt() {
    if (!fromDate || !toDate) {
      alert('Selecciona un rango de fechas para exportar');
      return;
    }
    retentionsApi.generateIvaTxt(fromDate, toDate).then(res => {
      const blob = new Blob([res.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename ?? 'ret-iva.txt';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function downloadXml() {
    if (!fromDate || !toDate) {
      alert('Selecciona un rango de fechas para exportar');
      return;
    }
    retentionsApi.generateIslrXml(fromDate, toDate).then(res => {
      const blob = new Blob([res.content], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename ?? 'ret-islr.xml';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Retenciones</h1>
          <p className="text-sm text-muted-foreground">
            Comprobantes IVA e ISLR generados al pagar facturas de compra
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTxt}>
            <FileText data-icon="inline-start" />
            TXT IVA
          </Button>
          <Button variant="outline" onClick={downloadXml}>
            <Download data-icon="inline-start" />
            XML ISLR
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>IVA retenido ({baseCode})</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(totalIva, baseCode)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ISLR retenido ({baseCode})</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(totalIslr, baseCode)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Comprobantes</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{filtered.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar por comprobante, factura o proveedor…"
                className="pl-8"
              />
            </div>
            <Select value={type} onValueChange={value => setType(value as 'ALL' | 'IVA' | 'ISLR')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="IVA">IVA</SelectItem>
                <SelectItem value="ISLR">ISLR</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Calendar className="size-4 text-muted-foreground" />
              <DatePicker
                value={fromDate}
                onChange={setFromDate}
                placeholder="Desde"
                className="w-40"
                clearable
                toDate={toDate || undefined}
              />
              <DatePicker
                value={toDate}
                onChange={setToDate}
                placeholder="Hasta"
                className="w-40"
                clearable
                fromDate={fromDate || undefined}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            {isLoading ? 'Cargando…' : `${filtered.length} comprobantes`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay retenciones en este rango. Se generan al registrar el pago de una factura de
              compra con retención.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="hidden md:table-cell">Factura</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Retenido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(retention => (
                  <TableRow key={retention.id}>
                    <TableCell className="font-mono text-xs">
                      {retention.voucherNumber ?? retention.code}
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(retention.date)}</TableCell>
                    <TableCell>
                      <Badge variant={retention.type === 'IVA' ? 'default' : 'secondary'}>
                        {retention.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{retention.partnerName ?? '—'}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {retention.invoiceCode ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(Number(retention.totalBase), rowCurrency(retention))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(Number(retention.totalTax), rowCurrency(retention))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatMoney(
                        Number(retention.totalRetainedBase ?? retention.totalRetained),
                        baseCode
                      )}
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
