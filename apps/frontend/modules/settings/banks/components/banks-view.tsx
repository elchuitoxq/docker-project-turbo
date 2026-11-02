'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  ListCard,
  ListEmptyRow,
  ListFilters,
  ListRowActions,
  ListSkeletonRows,
  ListTd,
  ListTh,
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/list/list-table';
import { Switch } from '@/components/ui/switch';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { banksApi, type Bank } from '../api';

/**
 * Catálogo de bancos (`settings:banks:*`, `T-05-02`).
 *
 * Los bancos no se borran: se desactivan. Una cuenta bancaria con pagos históricos seguiría
 * apuntando a un banco inexistente si se permitiera borrar, así que el backend expone `toggle`.
 */
export function BanksView() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSIONS.SETTINGS.BANKS.MANAGE);
  const [search, setSearch] = React.useState('');
  const [editing, setEditing] = React.useState<Bank | null>(null);
  const [creating, setCreating] = React.useState(false);

  const banks = useQuery({ queryKey: ['settings', 'banks'], queryFn: banksApi.list });

  const toggle = useMutation({
    mutationFn: (id: string) => banksApi.toggle(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'banks'] });
      toast.success('Estado del banco actualizado');
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el banco'),
  });

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = banks.data ?? [];

    if (!term) return list;

    return list.filter(
      bank => bank.name.toLowerCase().includes(term) || bank.code.toLowerCase().includes(term)
    );
  }, [banks.data, search]);

  const activeCount = (banks.data ?? []).filter(bank => bank.isActive !== false).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bancos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de bancos que se ofrecen al crear cuentas de tesorería
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            Nuevo banco
          </Button>
        )}
      </div>

      <ListFilters>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por nombre o código"
            className="pl-8"
            aria-label="Buscar banco"
          />
        </div>
      </ListFilters>

      <ListCard
        title={
          <>
            <Landmark className="size-4" /> {rows.length} bancos
          </>
        }
        description={`${activeCount} activos · un banco inactivo no se ofrece al crear cuentas`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ListTh>Código</ListTh>
              <ListTh>Banco</ListTh>
              <ListTh hide="sm">Creado</ListTh>
              <ListTh>Estado</ListTh>
              <ListTh align="right">Activo</ListTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banks.isLoading ? (
              <ListSkeletonRows rows={4} cols={5} />
            ) : rows.length === 0 ? (
              <ListEmptyRow
                cols={5}
                message={search ? 'Ningún banco coincide con la búsqueda' : 'Todavía no hay bancos'}
                hint={search ? undefined : 'Crea el primero para poder abrir cuentas bancarias'}
              />
            ) : (
              rows.map(bank => (
                <TableRow key={bank.id}>
                  <ListTd mono>{bank.code}</ListTd>
                  <ListTd className="font-medium">{bank.name}</ListTd>
                  <ListTd hide="sm" muted>
                    {bank.createdAt ? new Date(bank.createdAt).toLocaleDateString('es-VE') : '—'}
                  </ListTd>
                  <ListTd>
                    <Badge variant={bank.isActive === false ? 'secondary' : 'default'}>
                      {bank.isActive === false ? 'Inactivo' : 'Activo'}
                    </Badge>
                  </ListTd>
                  <ListTd align="right">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <Switch
                          checked={bank.isActive !== false}
                          disabled={toggle.isPending}
                          onCheckedChange={() => toggle.mutate(bank.id)}
                          aria-label={`Activar ${bank.name}`}
                        />
                      )}
                      <ListRowActions label={`Acciones de ${bank.name}`}>
                        <DropdownMenuItem disabled={!canManage} onClick={() => setEditing(bank)}>
                          <Pencil />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!canManage || toggle.isPending}
                          onClick={() => toggle.mutate(bank.id)}
                        >
                          {bank.isActive === false ? 'Activar' : 'Desactivar'}
                        </DropdownMenuItem>
                      </ListRowActions>
                    </div>
                  </ListTd>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ListCard>

      {(creating || editing) && (
        <BankDialog
          bank={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={async () => {
            setCreating(false);
            setEditing(null);
            await queryClient.invalidateQueries({ queryKey: ['settings', 'banks'] });
          }}
        />
      )}
    </div>
  );
}

function BankDialog({
  bank,
  onClose,
  onDone,
}: {
  bank: Bank | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = React.useState(bank?.name ?? '');
  const [code, setCode] = React.useState(bank?.code ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      bank
        ? banksApi.update(bank.id, { name: name.trim(), code: code.trim() })
        : banksApi.create({ name: name.trim(), code: code.trim() }),
    onSuccess: async () => {
      toast.success(bank ? 'Banco actualizado' : 'Banco creado');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el banco'),
  });

  const valid = name.trim().length > 0 && code.trim().length > 0;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bank ? 'Editar banco' : 'Nuevo banco'}</DialogTitle>
          <DialogDescription>
            El código es el de cuatro dígitos del banco (por ejemplo 0102 para Venezuela)
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="bank-code">Código</FieldLabel>
            <Input
              id="bank-code"
              value={code}
              onChange={event => setCode(event.target.value)}
              placeholder="0102"
              maxLength={8}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bank-name">Nombre</FieldLabel>
            <Input
              id="bank-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Banco de Venezuela"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            {bank ? 'Guardar cambios' : 'Crear banco'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
