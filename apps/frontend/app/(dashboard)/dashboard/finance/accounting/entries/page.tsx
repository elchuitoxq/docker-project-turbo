'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, CircleAlert, Plus, ScrollText, Trash2 } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAccounts, useCreateEntry, useEntries, usePostEntry } from '@/modules/accounting/hooks';
import {
  accountingApi,
  type AccountNode,
  type Entry,
  type EntrySourceType,
} from '@/modules/accounting/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/use-auth-store';
import { useBranchStore } from '@/stores/use-branch-store';

const SOURCE_LABEL: Record<string, string> = {
  INVOICE: 'Factura',
  PAYMENT: 'Pago',
  CREDIT_NOTE: 'Nota de crédito',
  PAYROLL: 'Nómina',
  INVENTORY: 'Inventario',
  MANUAL: 'Manual',
};

type DraftLine = { accountId: string; debit: string; credit: string };

function money(value: number): string {
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function date(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' });
}

function postableAccounts(nodes: AccountNode[]): AccountNode[] {
  return nodes.flatMap(node => [
    ...(node.isPostable ? [node] : []),
    ...postableAccounts(node.children),
  ]);
}

export default function EntriesPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const currentBranchId = useBranchStore(state => state.currentBranchId);
  const canCreate = permissions.includes(PERMISSIONS.FINANCE.ENTRIES.CREATE);
  const canPost = permissions.includes(PERMISSIONS.FINANCE.ENTRIES.POST);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceType, setSourceType] = useState<string>('all');

  const entries = useEntries({
    from: from || undefined,
    to: to || undefined,
    sourceType: sourceType === 'all' ? undefined : (sourceType as EntrySourceType),
  });
  const accounts = useAccounts();
  const createEntry = useCreateEntry();
  const postEntry = usePostEntry();

  const postable = useMemo(() => postableAccounts(accounts.data ?? []), [accounts.data]);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'POSTED' | 'DRAFT'>('POSTED');
  const [lines, setLines] = useState<DraftLine[]>([
    { accountId: '', debit: '', credit: '' },
    { accountId: '', debit: '', credit: '' },
  ]);
  const [detailId, setDetailId] = useState<string | null>(null);

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const difference = Number((totalDebit - totalCredit).toFixed(2));
  const balanced = Math.abs(difference) <= 0.01;
  const filledLines = lines.filter(
    line => line.accountId && (Number(line.debit) || Number(line.credit))
  );
  const canSave = balanced && filledLines.length >= 2;

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines(current =>
      current.map((line, position) => (position === index ? { ...line, ...patch } : line))
    );
  };

  const resetForm = () => {
    setLines([
      { accountId: '', debit: '', credit: '' },
      { accountId: '', debit: '', credit: '' },
    ]);
    setStatus('POSTED');
  };

  const submit = (form: FormData) => {
    const entryDate = String(form.get('date') ?? '');
    const description = String(form.get('description') ?? '').trim();
    const reference = String(form.get('reference') ?? '').trim();

    createEntry.mutate(
      {
        date: entryDate ? `${entryDate}T00:00:00.000Z` : new Date().toISOString(),
        description,
        reference: reference || null,
        branchId: currentBranchId ?? undefined,
        status,
        lines: filledLines.map(line => ({
          accountId: line.accountId,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
        })),
      },
      {
        onSuccess: created => {
          toast.success(
            status === 'DRAFT'
              ? `Borrador guardado: ${created.description}`
              : `Asiento registrado: ${created.description}`
          );
          setOpen(false);
          resetForm();
        },
        onError: error => toast.error(error.message),
      }
    );
  };

  const post = (entry: Entry) => {
    postEntry.mutate(entry.id, {
      onSuccess: () => toast.success(`Asiento posteado: ${entry.description}`),
      onError: error => toast.error(error.message),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link href="/dashboard/finance/accounting">
              <ArrowLeft data-icon="inline-start" />
              Plan de cuentas
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ScrollText className="text-muted-foreground" />
            Asientos
          </h1>
          <p className="text-muted-foreground text-sm">
            Cada asiento nace cuadrado o no se guarda. Un borrador no entra en los reportes.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" />
            Nuevo asiento
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>El rango de fechas incluye el día completo.</CardDescription>
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
            <Field className="w-52">
              <FieldLabel htmlFor="source">Origen</FieldLabel>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(SOURCE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="text-muted-foreground" />
            Libro de la sucursal
          </CardTitle>
          <CardDescription>
            {entries.isLoading
              ? 'Cargando…'
              : `${entries.data?.length ?? 0} asientos en el rango seleccionado`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (entries.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay asientos con esos filtros. Genera uno manual o publica una factura.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.data?.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {date(entry.date)}
                    </TableCell>
                    <TableCell className="font-medium">{entry.description}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.reference ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SOURCE_LABEL[entry.sourceType ?? 'MANUAL'] ?? entry.sourceType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'POSTED' ? 'default' : 'secondary'}>
                        {entry.status === 'POSTED' ? 'Posteado' : 'Borrador'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(entry.id)}>
                          Ver líneas
                        </Button>
                        {canPost && entry.status === 'DRAFT' ? (
                          <Button
                            size="sm"
                            onClick={() => post(entry)}
                            disabled={postEntry.isPending}
                          >
                            Postear
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EntryDetailDialog id={detailId} onClose={() => setDetailId(null)} />

      <Dialog
        open={open}
        onOpenChange={value => {
          setOpen(value);
          if (!value) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nuevo asiento</DialogTitle>
            <DialogDescription>
              La partida doble se valida en vivo: si el debe y el haber no coinciden, no se guarda.
            </DialogDescription>
          </DialogHeader>
          <form
            id="entry-form"
            onSubmit={event => {
              event.preventDefault();
              submit(new FormData(event.currentTarget));
            }}
          >
            <FieldGroup>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="date">Fecha</FieldLabel>
                  <Input id="date" name="date" type="date" defaultValue="2026-10-27" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reference">Referencia</FieldLabel>
                  <Input id="reference" name="reference" placeholder="AS-0001" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="description">Descripción</FieldLabel>
                <Input
                  id="description"
                  name="description"
                  placeholder="Provisión de prestaciones"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Guardar como</FieldLabel>
                <Select
                  value={status}
                  onValueChange={value => setStatus(value as 'POSTED' | 'DRAFT')}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="POSTED">Posteado (afecta el libro)</SelectItem>
                      <SelectItem value="DRAFT">Borrador (editable)</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </form>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Líneas</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines(current => [...current, { accountId: '', debit: '', credit: '' }])
                }
              >
                <Plus data-icon="inline-start" />
                Añadir línea
              </Button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
                <Select
                  value={line.accountId}
                  onValueChange={value => updateLine(index, { accountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cuenta imputable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {postable.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} · {account.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  aria-label={`Debe línea ${index + 1}`}
                  placeholder="Debe"
                  inputMode="decimal"
                  value={line.debit}
                  onChange={event => updateLine(index, { debit: event.target.value, credit: '' })}
                />
                <Input
                  aria-label={`Haber línea ${index + 1}`}
                  placeholder="Haber"
                  inputMode="decimal"
                  value={line.credit}
                  onChange={event => updateLine(index, { credit: event.target.value, debit: '' })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setLines(current => current.filter((_, i) => i !== index))}
                  disabled={lines.length <= 2}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                Debe {money(totalDebit)} · Haber {money(totalCredit)}
              </span>
              {totalDebit === 0 && totalCredit === 0 ? (
                <Badge variant="outline">Sin importes</Badge>
              ) : balanced ? (
                <Badge variant="default">Cuadrado</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <CircleAlert />
                  Diferencia {money(difference)}
                </Badge>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="entry-form" disabled={!canSave || createEntry.isPending}>
              {status === 'DRAFT' ? 'Guardar borrador' : 'Registrar asiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntryDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['accounting', 'entry', id ?? ''],
    queryFn: () => accountingApi.getEntry(id as string),
    enabled: !!id,
  });

  const totalDebit = (detail.data?.lines ?? []).reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = (detail.data?.lines ?? []).reduce((sum, line) => sum + line.credit, 0);

  return (
    <Dialog open={!!id} onOpenChange={value => (value ? undefined : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail.data?.description ?? 'Asiento'}</DialogTitle>
          <DialogDescription>
            {detail.data
              ? `${date(detail.data.date)} · ${SOURCE_LABEL[detail.data.sourceType ?? 'MANUAL'] ?? detail.data.sourceType} · ${detail.data.status === 'POSTED' ? 'posteado' : 'borrador'}`
              : 'Cargando líneas…'}
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.data?.lines.map((line, index) => (
                <TableRow key={line.id ?? index}>
                  <TableCell>
                    <span className="font-mono text-xs">{line.accountCode}</span>
                    <div className="text-muted-foreground text-xs">{line.accountName}</div>
                  </TableCell>
                  <TableCell className="text-right">{money(line.debit)}</TableCell>
                  <TableCell className="text-right">{money(line.credit)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Totales</TableCell>
                <TableCell className="text-right font-medium">{money(totalDebit)}</TableCell>
                <TableCell className="text-right font-medium">{money(totalCredit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
