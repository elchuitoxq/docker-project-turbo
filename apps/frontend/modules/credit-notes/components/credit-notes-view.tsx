'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileMinus, Plus, Ban, Send, Link2 } from 'lucide-react';
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
import { creditNotesApi, toCreditNoteList, type CreditNote, type CreditNoteStatus } from '../api';
import { invoicesApi } from '@/modules/orders/api';
import { formatCurrency, formatDay } from '@/lib/utils';

const STATUS_LABEL: Record<CreditNoteStatus, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Emitida',
  VOIDED: 'Anulada',
  APPLIED: 'Aplicada',
};

const STATUS_VARIANT: Record<
  CreditNoteStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  DRAFT: 'secondary',
  POSTED: 'default',
  VOIDED: 'destructive',
  APPLIED: 'outline',
};

/**
 * Notas de crédito (`T-07-02`).
 *
 * Se emiten contra una factura, se publican y luego se aplican: el saldo disponible baja con cada
 * aplicación y el backend rechaza pasarse del total de la nota o del saldo de la factura.
 */
export function CreditNotesView() {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<'ALL' | CreditNoteStatus>('ALL');
  const [creating, setCreating] = React.useState(false);
  const [applying, setApplying] = React.useState<CreditNote | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['credit-notes', status],
    queryFn: () => creditNotesApi.list(status === 'ALL' ? {} : { status }),
  });

  const notes = toCreditNoteList(data);

  const post = useMutation({
    mutationFn: (id: string) => creditNotesApi.post(id),
    onSuccess: async () => {
      toast.success('Nota de crédito emitida');
      await queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo emitir la nota'),
  });

  const voidNote = useMutation({
    mutationFn: (id: string) => creditNotesApi.void(id),
    onSuccess: async () => {
      toast.success('Nota de crédito anulada');
      await queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo anular la nota'),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notas de crédito</h1>
          <p className="text-sm text-muted-foreground">
            Devoluciones a clientes y a proveedores, con el saldo disponible de cada nota
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={status}
            onValueChange={value => setStatus(value as 'ALL' | CreditNoteStatus)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="POSTED">Emitida</SelectItem>
              <SelectItem value="APPLIED">Aplicada</SelectItem>
              <SelectItem value="VOIDED">Anulada</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            Nueva nota
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileMinus className="size-4" /> {notes.length} notas
          </CardTitle>
          <CardDescription>
            Una nota emitida descuenta el saldo del partner cuando se aplica a una factura
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay notas de crédito con este filtro.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nota</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map(note => (
                  <TableRow key={note.id}>
                    <TableCell className="font-medium">{note.code}</TableCell>
                    <TableCell>
                      <Badge variant={note.type === 'PURCHASE' ? 'secondary' : 'outline'}>
                        {note.type === 'PURCHASE' ? 'Compra' : 'Venta'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {note.invoiceId ? note.invoiceId.slice(0, 8) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(note.total))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(Number(note.availableAmount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[note.status]}>
                        {STATUS_LABEL[note.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {note.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => post.mutate(note.id)}
                            disabled={post.isPending}
                          >
                            <Send data-icon="inline-start" />
                            Emitir
                          </Button>
                        )}
                        {(note.status === 'POSTED' || note.status === 'APPLIED') &&
                          Number(note.availableAmount) > 0 && (
                            <Button size="sm" variant="outline" onClick={() => setApplying(note)}>
                              <Link2 data-icon="inline-start" />
                              Aplicar
                            </Button>
                          )}
                        {(note.status === 'DRAFT' || note.status === 'POSTED') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => voidNote.mutate(note.id)}
                            disabled={voidNote.isPending}
                          >
                            <Ban data-icon="inline-start" />
                            Anular
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateNoteDialog
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
          }}
        />
      )}

      {applying && (
        <ApplyDialog
          note={applying}
          onClose={() => setApplying(null)}
          onDone={async () => {
            setApplying(null);
            await queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
            await queryClient.invalidateQueries({ queryKey: ['payables'] });
          }}
        />
      )}
    </div>
  );
}

function CreateNoteDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [type, setType] = React.useState<'SALE' | 'PURCHASE'>('SALE');
  const [invoiceId, setInvoiceId] = React.useState('');
  const [quantities, setQuantities] = React.useState<Record<string, string>>({});

  const invoices = useQuery({
    queryKey: ['invoices', type],
    queryFn: () => invoicesApi.list({ type, status: 'POSTED' }),
  });

  const detail = useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: () => invoicesApi.getDetail(invoiceId),
    enabled: Boolean(invoiceId),
  });

  // El valor mostrado es el override del usuario o la cantidad original de la línea: sin efecto.
  const quantityOf = (productId: string, fallback: number): string =>
    quantities[productId] ?? String(fallback);

  const items = (detail.data?.items ?? [])
    .map(item => ({
      productId: item.productId,
      quantity: Number(quantityOf(item.productId, item.quantity) ?? 0),
      price: Number(item.price),
    }))
    .filter(item => item.quantity > 0);

  const estimated = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const mutation = useMutation({
    mutationFn: () => {
      if (!detail.data) throw new Error('Selecciona una factura');
      if (items.length === 0) throw new Error('Indica al menos una línea a devolver');

      return creditNotesApi.create({
        type,
        invoiceId: detail.data.id,
        partnerId: detail.data.partnerId,
        currencyId: detail.data.currencyId,
        exchangeRate: Number(detail.data.exchangeRate ?? 1) || 1,
        items,
      });
    },
    onSuccess: async () => {
      toast.success('Nota creada como borrador');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la nota'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva nota de crédito</DialogTitle>
          <DialogDescription>
            Se crea como borrador sobre una factura emitida, con las líneas que se devuelven
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cn-type">Tipo</FieldLabel>
            <Select
              value={type}
              onValueChange={value => {
                setType(value as 'SALE' | 'PURCHASE');
                setInvoiceId('');
              }}
            >
              <SelectTrigger id="cn-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SALE">Devolución a cliente</SelectItem>
                <SelectItem value="PURCHASE">Devolución a proveedor</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="cn-invoice">Factura</FieldLabel>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger id="cn-invoice">
                <SelectValue placeholder="Selecciona una factura emitida" />
              </SelectTrigger>
              <SelectContent>
                {(invoices.data?.data ?? []).map(invoice => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {invoice.code} · {invoice.partnerName ?? '—'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        {detail.data && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Líneas de la factura (ajusta la cantidad a devolver)
            </p>
            {detail.data.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 font-mono text-xs">{item.productId.slice(0, 8)}</span>
                <span className="w-24 text-right tabular-nums">
                  {formatCurrency(Number(item.price))}
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={quantityOf(item.productId, item.quantity)}
                  onChange={event =>
                    setQuantities(current => ({
                      ...current,
                      [item.productId]: event.target.value,
                    }))
                  }
                  className="w-24"
                />
              </div>
            ))}
            <p className="text-right text-sm font-medium">
              Total estimado {formatCurrency(estimated)}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!invoiceId || items.length === 0 || mutation.isPending}
          >
            Crear borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyDialog({
  note,
  onClose,
  onDone,
}: {
  note: CreditNote;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [amount, setAmount] = React.useState(String(note.availableAmount));

  const invoiceId = note.invoiceId ?? '';

  const mutation = useMutation({
    mutationFn: () => creditNotesApi.apply(note.id, invoiceId, Number(amount)),
    onSuccess: async () => {
      toast.success('Nota aplicada');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo aplicar la nota'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar {note.code}</DialogTitle>
          <DialogDescription>
            Disponible {formatCurrency(Number(note.availableAmount))} sobre la factura{' '}
            {invoiceId ? invoiceId.slice(0, 8) : '—'}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="apply-amount">Importe a aplicar</FieldLabel>
            <Input
              id="apply-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!invoiceId || Number(amount) <= 0 || mutation.isPending}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
