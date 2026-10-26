'use client';

import * as React from 'react';
import {
  Warehouse as WarehouseIcon,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useWarehouses, useCreateWarehouse, useDeleteWarehouse } from '../hooks/use-warehouses';

export function WarehousesView() {
  const t = useTranslations('common');
  const { hasPermission } = usePermission();
  const { data, isLoading } = useWarehouses();
  const create = useCreateWarehouse();
  const del = useDeleteWarehouse();
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const warehouses = (data ?? []).filter(
    w =>
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.address ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Almacenes</h1>
          <p className="text-sm text-muted-foreground">
            {warehouses.length} almacén{warehouses.length === 1 ? '' : 'es'}
          </p>
        </div>
        {hasPermission(PERMISSIONS.INVENTORY.WAREHOUSES.CREATE) && (
          <Button onClick={() => setOpen(true)}>
            <Plus /> Nuevo
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o dirección…"
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            {isLoading ? 'Cargando…' : `${warehouses.length} resultados`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : warehouses.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay almacenes</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Dirección</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <WarehouseIcon className="size-4 text-muted-foreground" />
                        {w.name}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {w.address ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={w.isActive ? 'default' : 'secondary'}>
                        {w.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              if (window.confirm(`¿Eliminar ${w.name}?`)) {
                                del.mutate(w.id, {
                                  onSuccess: () => toast.success('Almacén eliminado'),
                                  onError: () => toast.error('Error al eliminar'),
                                });
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateWarehouseDialog
        open={open}
        onOpenChange={setOpen}
        submitting={create.isPending}
        onSubmit={async data => {
          await create.mutateAsync(data);
          toast.success('Almacén creado');
          setOpen(false);
        }}
      />
    </div>
  );
}

function CreateWarehouseDialog({
  open,
  onOpenChange,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  submitting: boolean;
  onSubmit: (data: { name: string; address: string; isActive: boolean }) => void | Promise<void>;
}) {
  const t = useTranslations('common');
  const [name, setName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  function reset() {
    setName('');
    setAddress('');
    setIsActive(true);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={v => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nuevo almacén</SheetTitle>
          <SheetDescription>Registra un nuevo punto de almacenamiento</SheetDescription>
        </SheetHeader>
        <form
          onSubmit={async e => {
            e.preventDefault();
            await onSubmit({ name, address, isActive });
            reset();
          }}
          className="mt-6 space-y-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="wh-name">Nombre *</FieldLabel>
              <Input id="wh-name" value={name} onChange={e => setName(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="wh-address">Dirección</FieldLabel>
              <Input id="wh-address" value={address} onChange={e => setAddress(e.target.value)} />
            </Field>
            <Field orientation="horizontal" className="items-center gap-2 space-y-0">
              <Checkbox id="wh-active" checked={isActive} onCheckedChange={v => setIsActive(!!v)} />
              <FieldLabel htmlFor="wh-active" className="cursor-pointer">
                Activo
              </FieldLabel>
            </Field>
          </FieldGroup>
          <SheetFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !name}>
              {t('create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
