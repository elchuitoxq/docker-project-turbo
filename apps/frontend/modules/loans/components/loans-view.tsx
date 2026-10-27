'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Plus, ThumbsDown, ThumbsUp, Undo2 } from 'lucide-react';
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
import { loansApi, loanItemTotals, toLoanList, type Loan, type LoanStatus } from '../api';
import { PartnerCombobox } from '@/modules/partners/components/partner-combobox';
import { formatDay } from '@/lib/utils';

const STATUS_LABEL: Record<LoanStatus, string> = {
  PENDING: 'Pendiente',
  ACTIVE: 'Entregado',
  REJECTED: 'Rechazado',
  PAID: 'Devuelto',
  CANCELLED: 'Cancelado',
};

const STATUS_VARIANT: Record<LoanStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  ACTIVE: 'default',
  REJECTED: 'destructive',
  PAID: 'outline',
  CANCELLED: 'destructive',
};

/**
 * Préstamos de equipos (`T-07-03`).
 *
 * `loans` + `loan_items` modela la entrega de artículos a un tercero con su devolución: por eso las
 * acciones son "aprobar", "rechazar" y "registrar devolución", no "pagar".
 */
export function LoansView() {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<'ALL' | LoanStatus>('ALL');
  const [creating, setCreating] = React.useState(false);
  const [returning, setReturning] = React.useState<Loan | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['loans', status],
    queryFn: () => loansApi.list(status === 'ALL' ? {} : { status }),
  });

  const loans = toLoanList(data);

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      action === 'approve' ? loansApi.approve(id) : loansApi.reject(id),
    onSuccess: async () => {
      toast.success('Préstamo actualizado');
      await queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el préstamo'),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Préstamos de equipos</h1>
          <p className="text-sm text-muted-foreground">
            Entrega de artículos a un tercero con su devolución · ninguna línea descuenta inventario
            hasta que se aprueba
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={value => setStatus(value as 'ALL' | LoanStatus)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="PENDING">Pendiente</SelectItem>
              <SelectItem value="ACTIVE">Entregado</SelectItem>
              <SelectItem value="PAID">Devuelto</SelectItem>
              <SelectItem value="REJECTED">Rechazado</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            Nuevo préstamo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="size-4" /> {loans.length} préstamos
          </CardTitle>
          <CardDescription>
            Aprobar habilita la entrega; registrar la devolución cierra el préstamo
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : loans.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay préstamos con este filtro.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tercero</TableHead>
                  <TableHead>Artículos</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Devuelto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map(loan => {
                  const { delivered, returned } = loanItemTotals(loan);
                  return (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.code}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {loan.partnerId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {returned} / {delivered}
                      </TableCell>
                      <TableCell className="text-xs">
                        {loan.dueDate ? formatDay(loan.dueDate.slice(0, 10)) : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {loan.returnDate ? formatDay(loan.returnDate.slice(0, 10)) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[loan.status]}>
                          {STATUS_LABEL[loan.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {loan.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => decide.mutate({ id: loan.id, action: 'approve' })}
                                disabled={decide.isPending}
                              >
                                <ThumbsUp data-icon="inline-start" />
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => decide.mutate({ id: loan.id, action: 'reject' })}
                                disabled={decide.isPending}
                              >
                                <ThumbsDown data-icon="inline-start" />
                                Rechazar
                              </Button>
                            </>
                          )}
                          {loan.status === 'ACTIVE' && (
                            <Button size="sm" variant="outline" onClick={() => setReturning(loan)}>
                              <Undo2 data-icon="inline-start" />
                              Devolución
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateLoanDialog
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await queryClient.invalidateQueries({ queryKey: ['loans'] });
          }}
        />
      )}

      {returning && (
        <ReturnDialog
          loan={returning}
          onClose={() => setReturning(null)}
          onDone={async () => {
            setReturning(null);
            await queryClient.invalidateQueries({ queryKey: ['loans'] });
          }}
        />
      )}
    </div>
  );
}

function CreateLoanDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [code, setCode] = React.useState(
    () => `PRE-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`
  );
  const [partnerId, setPartnerId] = React.useState('');
  const [productId, setProductId] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');
  const [serialNumber, setSerialNumber] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const mutation = useMutation({
    mutationFn: () =>
      loansApi.create({
        code,
        partnerId,
        ...(dueDate ? { dueDate: new Date(`${dueDate}T23:59:59.000Z`).toISOString() } : {}),
        notes: notes || undefined,
        items: [
          {
            productId,
            quantity: Number(quantity),
            ...(serialNumber ? { serialNumber } : {}),
          },
        ],
      }),
    onSuccess: async () => {
      toast.success('Préstamo creado como pendiente');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el préstamo'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo préstamo de equipo</DialogTitle>
          <DialogDescription>
            Queda pendiente hasta que se apruebe; se entrega un artículo por préstamo
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="loan-code">Código</FieldLabel>
            <Input id="loan-code" value={code} onChange={event => setCode(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Tercero</FieldLabel>
            <PartnerCombobox value={partnerId} onChange={setPartnerId} />
          </Field>
          <Field>
            <FieldLabel htmlFor="loan-product">Producto (UUID)</FieldLabel>
            <Input
              id="loan-product"
              value={productId}
              onChange={event => setProductId(event.target.value)}
              placeholder="550e8400-e29b-41d4-a716-446655440000"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="loan-qty">Cantidad</FieldLabel>
            <Input
              id="loan-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="loan-serial">Serie</FieldLabel>
            <Input
              id="loan-serial"
              value={serialNumber}
              onChange={event => setSerialNumber(event.target.value)}
              placeholder="Opcional"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="loan-due">Vence</FieldLabel>
            <Input
              id="loan-due"
              type="date"
              value={dueDate}
              onChange={event => setDueDate(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="loan-notes">Notas</FieldLabel>
            <Textarea
              id="loan-notes"
              rows={2}
              value={notes}
              onChange={event => setNotes(event.target.value)}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!code.trim() || !partnerId || !productId || mutation.isPending}
          >
            Crear préstamo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({
  loan,
  onClose,
  onDone,
}: {
  loan: Loan;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const first = loan.items[0];
  const [productId, setProductId] = React.useState(first?.productId ?? '');
  const [quantity, setQuantity] = React.useState(String(first?.quantity ?? 1));
  const [serialNumber, setSerialNumber] = React.useState(first?.serialNumber ?? '');
  const [condition, setCondition] = React.useState('GOOD');

  const mutation = useMutation({
    mutationFn: () =>
      loansApi.registerReturn(loan.id, [
        {
          productId,
          quantity: Number(quantity),
          ...(serialNumber ? { serialNumber } : {}),
          condition,
        },
      ]),
    onSuccess: async () => {
      toast.success('Devolución registrada');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la devolución'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolución de {loan.code}</DialogTitle>
          <DialogDescription>
            Se registra el artículo devuelto con su condición; el préstamo sigue abierto hasta
            devolver todo
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ret-product">Producto</FieldLabel>
            <Input
              id="ret-product"
              value={productId}
              onChange={event => setProductId(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ret-qty">Cantidad</FieldLabel>
            <Input
              id="ret-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ret-serial">Serie</FieldLabel>
            <Input
              id="ret-serial"
              value={serialNumber}
              onChange={event => setSerialNumber(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ret-condition">Condición</FieldLabel>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger id="ret-condition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GOOD">Buen estado</SelectItem>
                <SelectItem value="DAMAGED">Con daños</SelectItem>
                <SelectItem value="LOST">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!productId || mutation.isPending}>
            Registrar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
