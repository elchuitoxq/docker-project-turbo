'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Link2, Unlink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import { Textarea } from '@/components/ui/textarea';
import { reconciliationApi, treasuryAccountsApi } from '../api/treasury-operations';
import { formatCurrency, formatDay } from '@/lib/utils';

/**
 * Conciliación bancaria (`T-05-04`, `T-05-05`, `T-05-08`).
 *
 * Se importa el extracto en CSV y se concilia cada línea con un pago; las sugerencias por monto y
 * fecha evitan conciliar a ciegas. Un pago no puede quedar en dos líneas.
 */
export function ReconciliationView() {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [importing, setImporting] = React.useState(false);

  const accounts = useQuery({ queryKey: ['bank-accounts'], queryFn: treasuryAccountsApi.list });

  // La primera cuenta se usa por defecto sin escribir estado en un efecto (evita renders en cascada).
  const activeAccountId = selectedAccountId || (accounts.data?.[0]?.id ?? '');

  const report = useQuery({
    queryKey: ['reconciliation', activeAccountId, from, to],
    queryFn: () => reconciliationApi.report(activeAccountId, { from, to }),
    enabled: Boolean(activeAccountId),
  });

  const match = useMutation({
    mutationFn: ({ lineId, paymentId }: { lineId: string; paymentId: string }) =>
      reconciliationApi.match(lineId, paymentId),
    onSuccess: async () => {
      toast.success('Línea conciliada');
      await queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'No se pudo conciliar'),
  });

  const unmatch = useMutation({
    mutationFn: (lineId: string) => reconciliationApi.unmatch(lineId),
    onSuccess: async () => {
      toast.success('Conciliación deshecha');
      await queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo desconciliar'),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conciliación bancaria</h1>
          <p className="text-sm text-muted-foreground">
            Extracto contra pagos y cobros del sistema, con sugerencias por monto y fecha
          </p>
        </div>
        <Button onClick={() => setImporting(true)} disabled={!activeAccountId}>
          <Upload data-icon="inline-start" />
          Importar extracto
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-end">
          <Field className="flex-1">
            <FieldLabel>Cuenta</FieldLabel>
            <Select value={activeAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="w-44">
            <FieldLabel htmlFor="recon-from">Desde</FieldLabel>
            <Input
              id="recon-from"
              type="date"
              value={from}
              onChange={event => setFrom(event.target.value)}
            />
          </Field>
          <Field className="w-44">
            <FieldLabel htmlFor="recon-to">Hasta</FieldLabel>
            <Input
              id="recon-to"
              type="date"
              value={to}
              onChange={event => setTo(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Líneas del extracto</CardDescription>
            <CardTitle className="text-2xl">{report.data?.totalLines ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Conciliadas</CardDescription>
            <CardTitle className="text-2xl">{report.data?.matchedLines ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pagos sin conciliar</CardDescription>
            <CardTitle className="text-2xl">{report.data?.unmatchedPayments.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Líneas del extracto</CardTitle>
          <CardDescription>
            Al conciliar, el pago queda marcado y no puede usarse en otra línea
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {report.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (report.data?.lines ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay líneas importadas para esta cuenta y rango.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report.data?.lines ?? []).map(line => {
                  const suggestion = line.suggestions?.[0];

                  return (
                    <TableRow key={line.id}>
                      <TableCell>{formatDay(line.date)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(line.amount, 'USD')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {line.reference ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {line.description ?? '—'}
                      </TableCell>
                      <TableCell>
                        {line.matched ? (
                          <Badge>
                            <CheckCircle2 className="mr-1 size-3" /> Conciliada
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.matched ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unmatch.mutate(line.id)}
                            disabled={unmatch.isPending}
                          >
                            <Unlink data-icon="inline-start" />
                            Desconciliar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant={suggestion ? 'default' : 'outline'}
                            onClick={() =>
                              suggestion &&
                              match.mutate({ lineId: line.id, paymentId: suggestion.paymentId })
                            }
                            disabled={!suggestion || match.isPending}
                          >
                            <Link2 data-icon="inline-start" />
                            {suggestion ? `Conciliar ${suggestion.code}` : 'Sin sugerencia'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {importing && activeAccountId && (
        <ImportDialog
          bankAccountId={activeAccountId}
          onClose={() => setImporting(false)}
          onDone={async () => {
            setImporting(false);
            await queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
          }}
        />
      )}
    </div>
  );
}

function ImportDialog({
  bankAccountId,
  onClose,
  onDone,
}: {
  bankAccountId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [fileName, setFileName] = React.useState('extracto.csv');
  const [content, setContent] = React.useState('');

  const mutation = useMutation({
    mutationFn: () => reconciliationApi.importCsv({ bankAccountId, fileName, content }),
    onSuccess: async result => {
      toast.success(
        result.duplicated
          ? 'Ese extracto ya estaba importado'
          : `${result.linesCount} líneas importadas`
      );
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo importar el extracto'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar extracto</DialogTitle>
          <DialogDescription>
            Una línea por renglón: <code>fecha,monto,referencia,descripción</code>. El monto
            negativo es un egreso. Reimportar el mismo archivo no duplica líneas.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="import-name">Nombre del archivo</FieldLabel>
            <Input
              id="import-name"
              value={fileName}
              onChange={event => setFileName(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="import-content">Contenido CSV</FieldLabel>
            <Textarea
              id="import-content"
              rows={8}
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder={
                '2026-10-24,500.00,TRF-001,Cobro cliente\n2026-10-24,-120.00,CHQ-9,Proveedor'
              }
              className="font-mono text-xs"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!content.trim() || mutation.isPending}
          >
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
