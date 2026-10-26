'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Building2, MoreHorizontal, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useDepartments, useCreateDepartment } from '../hooks';
import { useEmployees } from '../hooks';
import { toast } from 'sonner';

export function DepartmentsView() {
  const { data: departments = [], isLoading } = useDepartments();
  const { data: employeesData } = useEmployees({ limit: 100 });
  const create = useCreateDepartment();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  function reset() {
    setName('');
    setDescription('');
    setIsActive(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Departamentos</h1>
          <p className="text-sm text-muted-foreground">Estructura organizacional</p>
        </div>
        <Sheet
          open={open}
          onOpenChange={v => {
            if (!v) reset();
            setOpen(v);
          }}
        >
          <SheetTrigger asChild>
            <Button>
              <Plus /> Nuevo
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Nuevo departamento</SheetTitle>
              <SheetDescription>Crea un departamento o unidad organizacional</SheetDescription>
            </SheetHeader>
            <form
              onSubmit={async e => {
                e.preventDefault();
                try {
                  await create.mutateAsync({ name, description, isActive });
                  toast.success('Departamento creado');
                  setOpen(false);
                  reset();
                } catch {
                  toast.error('Error al crear');
                }
              }}
              className="mt-6 space-y-4"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="dep-name">Nombre *</FieldLabel>
                  <Input
                    id="dep-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dep-desc">Descripción</FieldLabel>
                  <Textarea
                    id="dep-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                  />
                </Field>
                <Field orientation="horizontal" className="items-center gap-2 space-y-0">
                  <Checkbox
                    id="dep-active"
                    checked={isActive}
                    onCheckedChange={v => setIsActive(!!v)}
                  />
                  <FieldLabel htmlFor="dep-active" className="cursor-pointer">
                    Activo
                  </FieldLabel>
                </Field>
              </FieldGroup>
              <SheetFooter className="flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={create.isPending || !name}>
                  Crear
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Cargando…'
              : `${departments.length} departamento${departments.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay departamentos
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Descripción</TableHead>
                  <TableHead className="hidden md:table-cell">Gerente</TableHead>
                  <TableHead>Empleados</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map(d => {
                  const count = (employeesData?.data ?? []).filter(
                    e => e.departmentId === d.id
                  ).length;
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="size-4 text-muted-foreground" />
                          <span className="font-medium">{d.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {d.description ?? '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {d.managerName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="size-3.5 text-muted-foreground" />
                          <span className="tabular-nums">{count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.isActive ? 'default' : 'secondary'}>
                          {d.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
