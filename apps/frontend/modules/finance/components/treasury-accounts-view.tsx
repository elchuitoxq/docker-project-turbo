'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus } from 'lucide-react';
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
import {
  treasuryAccountsApi,
  type BankAccountAdmin,
} from '@/modules/finance/api/treasury-operations';
import { apiClient } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils';

type Currency = { id: string; code: string; name: string };

function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: () => apiClient.get<Currency[]>('/settings/currencies'),
  });
}

/**
 * Cuentas bancarias por sucursal (`T-05-02`, `T-05-08`).
 *
 * El saldo inicial es el de apertura; el saldo actual lo mueven los pagos y cobros.
 */
export function TreasuryAccountsView() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = React.useState(false);

  const accounts = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: treasuryAccountsApi.list,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas bancarias</h1>
          <p className="text-sm text-muted-foreground">
            Cuentas por sucursal con su saldo de apertura y saldo actual
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          Nueva cuenta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-4" /> {(accounts.data ?? []).length} cuentas
          </CardTitle>
          <CardDescription>
            Una cuenta inactiva no se ofrece al registrar pagos ni al conciliar
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (accounts.data ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Todavía no hay cuentas bancarias en esta sucursal.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo inicial</TableHead>
                  <TableHead className="text-right">Saldo actual</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(accounts.data ?? []).map(account => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {account.accountNumber ?? '—'}
                    </TableCell>
                    <TableCell>{account.type}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(account.initialBalance ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(account.currentBalance)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.isActive ? 'default' : 'secondary'}>
                        {account.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateAccountDialog
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
          }}
        />
      )}
    </div>
  );
}

function CreateAccountDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [type, setType] = React.useState('CHECKING');
  const [currencyId, setCurrencyId] = React.useState('');
  const [initialBalance, setInitialBalance] = React.useState('0');

  const currencies = useCurrencies();

  const mutation = useMutation({
    mutationFn: () =>
      treasuryAccountsApi.create({
        name,
        accountNumber,
        type,
        currencyId,
        initialBalance: Number(initialBalance || 0),
      }),
    onSuccess: async () => {
      toast.success('Cuenta creada');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la cuenta'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cuenta bancaria</DialogTitle>
          <DialogDescription>
            Se crea en la sucursal activa; el saldo inicial es el de apertura
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="account-name">Nombre</FieldLabel>
            <Input
              id="account-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Banesco Principal"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="account-number">Número de cuenta</FieldLabel>
            <Input
              id="account-number"
              value={accountNumber}
              onChange={event => setAccountNumber(event.target.value)}
              placeholder="0134-0000-00-0000000000"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="account-type">Tipo</FieldLabel>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CHECKING">Corriente</SelectItem>
                <SelectItem value="SAVINGS">Ahorro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="account-currency">Moneda</FieldLabel>
            <Select value={currencyId} onValueChange={setCurrencyId}>
              <SelectTrigger id="account-currency">
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
            <FieldLabel htmlFor="account-balance">Saldo inicial</FieldLabel>
            <Input
              id="account-balance"
              type="number"
              min={0}
              step="0.01"
              value={initialBalance}
              onChange={event => setInitialBalance(event.target.value)}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || !currencyId || mutation.isPending}
          >
            Crear cuenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
