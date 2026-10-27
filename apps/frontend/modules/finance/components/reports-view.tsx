'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, CircleAlert, Download, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
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
import { reportsApi, type FiscalBook } from '../api/reports';
import { ApiError } from '@/lib/api/client';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/use-auth-store';

function money(value: number): string {
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReportsView() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canExport = permissions.includes(PERMISSIONS.FINANCE.REPORTS.VIEW);

  const [from, setFrom] = React.useState('2026-10-01');
  const [to, setTo] = React.useState('2026-10-31');
  const [busy, setBusy] = React.useState<string | null>(null);

  const sales = useQuery({
    queryKey: ['fiscal', 'sales', from, to],
    queryFn: () => reportsApi.salesBook(from, to),
  });
  const purchases = useQuery({
    queryKey: ['fiscal', 'purchases', from, to],
    queryFn: () => reportsApi.purchaseBook(from, to),
  });
  const validation = useQuery({
    queryKey: ['fiscal', 'validation', from, to],
    queryFn: () => reportsApi.validation(from, to),
  });
  const summary = useQuery({
    queryKey: ['fiscal', 'summary', from, to],
    queryFn: () => reportsApi.summary(from, to),
  });

  const download = async (
    reportType: 'LIBRO_VENTAS' | 'LIBRO_COMPRAS' | 'RETENCIONES_IVA' | 'RETENCIONES_ISLR'
  ) => {
    setBusy(reportType);
    try {
      const format =
        reportType === 'RETENCIONES_ISLR'
          ? 'XML'
          : reportType === 'RETENCIONES_IVA'
            ? 'TXT'
            : 'CSV';
      const result = await reportsApi.exportReport({ reportType, format, from, to });

      const extension = format.toLowerCase();
      const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${result.code}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success(`Archivo ${result.code} generado (${result.sizeBytes} bytes)`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('La validación fiscal tiene errores: revisa el panel antes de exportar');
      } else {
        toast.error(error instanceof Error ? error.message : 'No se pudo generar el archivo');
      }
    } finally {
      setBusy(null);
    }
  };

  const findings = validation.data?.findings ?? [];
  const blocked = validation.data?.canExport === false || !canExport;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reportes fiscales</h1>
        <p className="text-muted-foreground text-sm">
          Libros de venta y compra en moneda funcional, con totales por alícuota. Las notas de
          crédito restan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
          <CardDescription>El rango incluye el día completo en ambas fechas.</CardDescription>
        </CardHeader>
        <CardContent>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {validation.data?.canExport === false ? (
              <CircleAlert className="text-destructive" />
            ) : (
              <CheckCircle2 className="text-muted-foreground" />
            )}
            Validación previa
          </CardTitle>
          <CardDescription>
            {validation.isLoading
              ? 'Revisando…'
              : `${validation.data?.errors ?? 0} error(es) · ${validation.data?.warnings ?? 0} advertencia(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {validation.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : findings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin hallazgos: RIF, números de control y secuencia en orden.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {findings.map((finding, index) => (
                <li key={`${finding.code}-${index}`} className="flex items-start gap-2 text-sm">
                  <Badge variant={finding.severity === 'ERROR' ? 'destructive' : 'secondary'}>
                    {finding.severity === 'ERROR' ? 'Error' : 'Aviso'}
                  </Badge>
                  <span>
                    <span className="text-muted-foreground font-mono text-xs">{finding.code}</span>{' '}
                    {finding.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Base imponible"
          value={summary.data?.totalBaseImponible}
          loading={summary.isLoading}
        />
        <SummaryCard label="IVA" value={summary.data?.totalIva} loading={summary.isLoading} />
        <SummaryCard label="IGTF" value={summary.data?.totalIgtf} loading={summary.isLoading} />
        <SummaryCard
          label="Retenciones ISLR"
          value={summary.data?.totalRetencionesIslr}
          loading={summary.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="text-muted-foreground" />
            Libros del período
          </CardTitle>
          <CardDescription>
            La exportación queda registrada con su hash y un correlativo por sucursal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sales">
            <TabsList>
              <TabsTrigger value="sales">Libro de ventas</TabsTrigger>
              <TabsTrigger value="purchases">Libro de compras</TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <BookTable
                book={sales.data}
                loading={sales.isLoading}
                onExport={() => download('LIBRO_VENTAS')}
                busy={busy === 'LIBRO_VENTAS'}
                disabled={blocked}
              />
            </TabsContent>
            <TabsContent value="purchases">
              <BookTable
                book={purchases.data}
                loading={purchases.isLoading}
                onExport={() => download('LIBRO_COMPRAS')}
                busy={busy === 'LIBRO_COMPRAS'}
                disabled={blocked}
              />
            </TabsContent>
          </Tabs>

          <Separator className="my-4" />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => download('RETENCIONES_IVA')}
              disabled={blocked || busy !== null}
            >
              <Download data-icon="inline-start" />
              Retenciones IVA (TXT)
            </Button>
            <Button
              variant="outline"
              onClick={() => download('RETENCIONES_ISLR')}
              disabled={blocked || busy !== null}
            >
              <Download data-icon="inline-start" />
              Retenciones ISLR (XML)
            </Button>
            {validation.data?.canExport === false ? (
              <span className="text-destructive flex items-center gap-1 text-xs">
                <AlertTriangle />
                Corrige los errores para exportar
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  loading,
}: {
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{loading ? '—' : money(value ?? 0)}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function BookTable({
  book,
  loading,
  onExport,
  busy,
  disabled,
}: {
  book?: FiscalBook;
  loading: boolean;
  onExport: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  if (loading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm">
          {book?.totals.documents ?? 0} documentos ·{' '}
          {book?.consistent === false ? 'no cuadra' : 'cuadra'}
        </span>
        <Button size="sm" onClick={onExport} disabled={disabled || busy}>
          <Download data-icon="inline-start" />
          {busy ? 'Generando…' : 'Exportar CSV'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>RIF</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead className="text-right">Exento</TableHead>
            <TableHead className="text-right">Base</TableHead>
            <TableHead className="text-right">IVA</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(book?.rows.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground text-sm">
                Sin documentos posteados en el período.
              </TableCell>
            </TableRow>
          ) : (
            book?.rows.map((row, index) => (
              <TableRow key={`${row.code}-${index}`}>
                <TableCell className="text-muted-foreground text-xs">{row.date}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.code}
                  {row.documentType === 'CREDIT_NOTE' ? ' (NC)' : ''}
                </TableCell>
                <TableCell className="font-mono text-xs">{row.partnerTaxId}</TableCell>
                <TableCell>{row.partnerName}</TableCell>
                <TableCell className="text-right">{money(row.exempt)}</TableCell>
                <TableCell className="text-right">{money(row.base)}</TableCell>
                <TableCell className="text-right">{money(row.tax)}</TableCell>
                <TableCell className="text-right font-medium">{money(row.total)}</TableCell>
              </TableRow>
            ))
          )}
          <TableRow>
            <TableCell colSpan={4} className="font-medium">
              Totales
            </TableCell>
            <TableCell className="text-right font-medium">
              {money(book?.totals.exempt ?? 0)}
            </TableCell>
            <TableCell className="text-right font-medium">
              {money(book?.totals.base ?? 0)}
            </TableCell>
            <TableCell className="text-right font-medium">{money(book?.totals.tax ?? 0)}</TableCell>
            <TableCell className="text-right font-medium">
              {money(book?.totals.total ?? 0)}
            </TableCell>
          </TableRow>
          {book?.totals.byRate.map(bucket => (
            <TableRow key={bucket.rate}>
              <TableCell colSpan={4} className="text-muted-foreground text-xs">
                Alícuota {bucket.rate}%
              </TableCell>
              <TableCell />
              <TableCell className="text-right text-xs">{money(bucket.base)}</TableCell>
              <TableCell className="text-right text-xs">{money(bucket.tax)}</TableCell>
              <TableCell className="text-right text-xs">
                {money(bucket.base + bucket.tax)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
