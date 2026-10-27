'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PiggyBank, Plus, Receipt, RotateCcw } from 'lucide-react';
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
import { pettyCashApi, type PettyCashFund } from '../api/treasury-operations';
import { apiClient } from '@/lib/api/client';
import { formatCurrency, formatDay } from '@/lib/utils';

type Currency = { id: string; code: string; name: string };

/** Caja chica de fondo fijo (`T-05-07`, HU-5 de `S-05`). */
export function PettyCashView() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = React.useState(false);
  const [movementFor, setMovementFor] = React.useState<PettyCashFund | null>(null);
  const [closingFund, setClosingFund] = React.useState<PettyCashFund | null>(null);

  const funds = useQuery({ queryKey: ['petty-cash'], queryFn: pettyCashApi.list });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['petty-cash'] });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Caja chica</h1>
          <p className="text-sm text-muted-foreground">
            Fondos fijos con rendiciones y reposición; el fondo nunca queda negativo
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          Nuevo fondo
        </Button>
      </div>

      {funds.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (funds.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <PiggyBank className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay fondos de caja chica en esta sucursal.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(funds.data ?? []).map(fund => (
            <Card key={fund.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <PiggyBank className="size-4" /> {fund.name}
                  </span>
                  <Badge variant={fund.status === 'OPEN' ? 'default' : 'secondary'}>
                    {fund.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Fondo {formatCurrency(fund.amount)} · saldo {formatCurrency(fund.balance)} ·
                  gastado desde la última reposición {formatCurrency(fund.spentSinceReplenishment)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fund.movements.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-muted-foreground"
                        >
                          Sin movimientos
                        </TableCell>
                      </TableRow>
                    ) : (
                      fund.movements.map(movement => (
                        <TableRow key={movement.id}>
                          <TableCell>{formatDay(movement.date)}</TableCell>
                          <TableCell>
                            <Badge variant={movement.type === 'EXPENSE' ? 'secondary' : 'outline'}>
                              {movement.type === 'EXPENSE'
                                ? 'Gasto'
                                : movement.type === 'REPLENISHMENT'
                                  ? 'Reposición'
                                  : 'Devolución'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {movement.description ?? '—'}
                            {movement.receiptNumber ? ` · ${movement.receiptNumber}` : ''}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(movement.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {fund.status === 'OPEN' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setMovementFor(fund)}>
                      <Receipt data-icon="inline-start" />
                      Registrar gasto
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMovementFor(fund);
                      }}
                    >
                      <RotateCcw data-icon="inline-start" />
                      Reponer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setClosingFund(fund)}>
                      Cerrar fondo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <CreateFundDialog
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await invalidate();
          }}
        />
      )}

      {movementFor && (
        <MovementDialog
          fund={movementFor}
          onClose={() => setMovementFor(null)}
          onDone={async () => {
            setMovementFor(null);
            await invalidate();
          }}
        />
      )}

      {closingFund && (
        <CloseFundDialog
          fund={closingFund}
          onClose={() => setClosingFund(null)}
          onDone={async () => {
            setClosingFund(null);
            await invalidate();
          }}
        />
      )}
    </div>
  );
}

function CreateFundDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('200');
  const [currencyId, setCurrencyId] = React.useState('');

  const currencies = useQuery({
    queryKey: ['currencies'],
    queryFn: () => apiClient.get<Currency[]>('/settings/currencies'),
  });

  const mutation = useMutation({
    mutationFn: () => pettyCashApi.create({ name, currencyId, amount: Number(amount) }),
    onSuccess: async () => {
      toast.success('Fondo creado');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el fondo'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo fondo de caja chica</DialogTitle>
          <DialogDescription>El fondo nace con el monto disponible</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="fund-name">Nombre</FieldLabel>
            <Input
              id="fund-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Caja chica administración"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fund-currency">Moneda</FieldLabel>
            <Select value={currencyId} onValueChange={setCurrencyId}>
              <SelectTrigger id="fund-currency">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {(currencies.data ?? []).map(currency => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="fund-amount">Monto del fondo</FieldLabel>
            <Input
              id="fund-amount"
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
            disabled={!name.trim() || !currencyId || Number(amount) <= 0 || mutation.isPending}
          >
            Crear fondo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({
  fund,
  onClose,
  onDone,
}: {
  fund: PettyCashFund;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [type, setType] = React.useState<'EXPENSE' | 'REPLENISHMENT'>('EXPENSE');
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [receiptNumber, setReceiptNumber] = React.useState('');
  const date = new Date().toISOString().slice(0, 10);

  const mutation = useMutation({
    mutationFn: () =>
      pettyCashApi.addMovement(fund.id, {
        date,
        type,
        amount: Number(amount),
        description: description || undefined,
        receiptNumber: receiptNumber || undefined,
      }),
    onSuccess: async () => {
      toast.success('Movimiento registrado');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el movimiento'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fund.name}</DialogTitle>
          <DialogDescription>Saldo disponible {formatCurrency(fund.balance)}</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="mov-type">Tipo</FieldLabel>
            <Select
              value={type}
              onValueChange={value => setType(value as 'EXPENSE' | 'REPLENISHMENT')}
            >
              <SelectTrigger id="mov-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Gasto</SelectItem>
                <SelectItem value="REPLENISHMENT">Reposición</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="mov-amount">Monto</FieldLabel>
            <Input
              id="mov-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="mov-desc">Descripción</FieldLabel>
            <Input
              id="mov-desc"
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Taxi al banco"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="mov-receipt">Comprobante</FieldLabel>
            <Input
              id="mov-receipt"
              value={receiptNumber}
              onChange={event => setReceiptNumber(event.target.value)}
              placeholder="REC-0001"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!amount || Number(amount) <= 0 || mutation.isPending}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseFundDialog({
  fund,
  onClose,
  onDone,
}: {
  fund: PettyCashFund;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [returnedAmount, setReturnedAmount] = React.useState(String(fund.balance));

  const mutation = useMutation({
    mutationFn: () => pettyCashApi.close(fund.id, Number(returnedAmount)),
    onSuccess: async () => {
      toast.success('Fondo cerrado');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo cerrar el fondo'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar {fund.name}</DialogTitle>
          <DialogDescription>
            Para cerrar hay que devolver el saldo completo ({formatCurrency(fund.balance)})
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="returned">Saldo devuelto</FieldLabel>
            <Input
              id="returned"
              type="number"
              min={0}
              step="0.01"
              value={returnedAmount}
              onChange={event => setReturnedAmount(event.target.value)}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Cerrar fondo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
