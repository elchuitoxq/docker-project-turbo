'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BookOpen, ChevronRight, Plus, ScrollText, ShieldAlert, Trash2 } from 'lucide-react';
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
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from '@/modules/accounting/hooks';
import type { AccountNode, AccountType } from '@/modules/accounting/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/use-auth-store';
import { useBranchStore } from '@/stores/use-branch-store';

const TYPE_LABEL: Record<AccountType, string> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Patrimonio',
  REVENUE: 'Ingreso',
  EXPENSE: 'Gasto',
  COST: 'Costo',
  ORDER: 'Orden',
};

const TYPE_ORDER: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'COST',
  'EXPENSE',
  'ORDER',
];

type FlatAccount = { account: AccountNode; depth: number };

function flatten(nodes: AccountNode[], depth = 0): FlatAccount[] {
  return nodes.flatMap(node => [{ account: node, depth }, ...flatten(node.children, depth + 1)]);
}

export default function AccountsPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const currentBranchId = useBranchStore(state => state.currentBranchId);
  const canManage = permissions.includes(PERMISSIONS.FINANCE.ACCOUNTS.MANAGE);

  const accounts = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState<string>('none');
  const [type, setType] = useState<AccountType>('ASSET');

  const flat = useMemo(() => flatten(accounts.data ?? []), [accounts.data]);
  const byId = useMemo(() => new Map(flat.map(item => [item.account.id, item.account])), [flat]);

  const postableCount = flat.filter(item => item.account.isPostable).length;

  const submit = (form: FormData) => {
    const code = String(form.get('code') ?? '').trim();
    const name = String(form.get('name') ?? '').trim();
    const parent = parentId === 'none' ? undefined : byId.get(parentId);

    createAccount.mutate(
      {
        code,
        name,
        type: parent ? parent.type : type,
        parentId: parent?.id,
        branchId: parent?.branchId ?? currentBranchId ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Cuenta ${code} creada`);
          setOpen(false);
          setParentId('none');
          setType('ASSET');
        },
        onError: error => toast.error(error.message),
      }
    );
  };

  const togglePostable = (account: AccountNode) => {
    updateAccount.mutate(
      { id: account.id, body: { isPostable: !account.isPostable } },
      {
        onSuccess: () =>
          toast.success(
            `Cuenta ${account.code} ${account.isPostable ? 'deja de ser imputable' : 'es imputable'}`
          ),
        onError: error => toast.error(error.message),
      }
    );
  };

  const remove = (account: AccountNode) => {
    deleteAccount.mutate(account.id, {
      onSuccess: () => toast.success(`Cuenta ${account.code} desactivada`),
      onError: error => toast.error(error.message),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BookOpen className="text-muted-foreground" />
            Plan de cuentas
          </h1>
          <p className="text-muted-foreground text-sm">
            Árbol contable de la sucursal. Una cuenta con hijas no es imputable: el asiento siempre
            va al detalle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/finance/accounting/entries">
              <ScrollText data-icon="inline-start" />
              Asientos
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/finance/accounting/periods">
              <ShieldAlert data-icon="inline-start" />
              Cierre y reportes
            </Link>
          </Button>
          {canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Plus data-icon="inline-start" />
              Nueva cuenta
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="text-muted-foreground" />
            Catálogo de la sucursal
          </CardTitle>
          <CardDescription>
            {accounts.isLoading
              ? 'Cargando…'
              : `${flat.length} cuentas · ${postableCount} imputables · el resto agrupa`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : flat.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              La sucursal no tiene plan de cuentas. Créalo desde aquí o ejecuta el seed de catálogo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Naturaleza</TableHead>
                  <TableHead>Imputable</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flat.map(({ account, depth }) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono text-xs">
                      <span style={{ paddingLeft: `${depth * 14}px` }} className="inline-flex">
                        {depth > 0 ? <ChevronRight className="text-muted-foreground" /> : null}
                        {account.code}
                      </span>
                    </TableCell>
                    <TableCell className={depth === 0 ? 'font-medium' : undefined}>
                      {account.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.type === 'ASSET' ? 'default' : 'secondary'}>
                        {TYPE_LABEL[account.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.isPostable ? (
                        <Badge variant="outline">Sí</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Agrupa</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePostable(account)}
                            disabled={account.children.length > 0}
                          >
                            {account.isPostable ? 'Dejar de imputar' : 'Hacer imputable'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(account)}
                            disabled={deleteAccount.isPending}
                          >
                            <Trash2 data-icon="inline-start" />
                            Desactivar
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva cuenta</DialogTitle>
            <DialogDescription>
              Si eliges una cuenta madre, la hija hereda su naturaleza y la madre deja de ser
              imputable.
            </DialogDescription>
          </DialogHeader>
          <form
            id="account-form"
            onSubmit={event => {
              event.preventDefault();
              submit(new FormData(event.currentTarget));
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="code">Código</FieldLabel>
                <Input id="code" name="code" placeholder="1.1.1.004" required />
                <FieldDescription>Único dentro de la sucursal.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="name">Nombre</FieldLabel>
                <Input id="name" name="name" placeholder="Caja chica" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="parent">Cuenta madre</FieldLabel>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="Sin cuenta madre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">Sin cuenta madre (raíz)</SelectItem>
                      {flat
                        .filter(item => !item.account.isPostable)
                        .map(item => (
                          <SelectItem key={item.account.id} value={item.account.id}>
                            {item.account.code} · {item.account.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="type">Naturaleza</FieldLabel>
                <Select
                  value={type}
                  onValueChange={value => setType(value as AccountType)}
                  disabled={parentId !== 'none'}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {TYPE_ORDER.map(option => (
                        <SelectItem key={option} value={option}>
                          {TYPE_LABEL[option]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {parentId === 'none'
                    ? 'Sólo se usa en cuentas raíz.'
                    : 'Las hijas heredan la naturaleza de la madre.'}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="account-form" disabled={createAccount.isPending}>
              Crear cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
