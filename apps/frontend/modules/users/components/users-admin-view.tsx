'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search, Shield, Trash2, UserRoundPen } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { branchesApi } from '@/modules/branches/api';
import type { Branch } from '@/modules/branches/api';
import { rolesApi, type ManagedRole } from '@/modules/roles/api';
import { useAuthStore } from '@/stores/use-auth-store';
import { usersApi, type ManagedUser, type UserInput } from '../api';

type UserFormProps = {
  open: boolean;
  user: ManagedUser | null;
  roles: ManagedRole[];
  branches: Branch[];
  onOpenChange: (open: boolean) => void;
  onSave: (user: ManagedUser | null, body: UserInput) => void;
  pending: boolean;
  canManageRoleAssignments: boolean;
  canManageBranchAssignments: boolean;
};

export function UsersAdminView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canCreateUsers = permissions.includes('settings:users:create');
  const canManageUsers = permissions.includes('settings:users:manage');
  const canViewRoles = permissions.includes('settings:roles:view');
  const canManageBranches = permissions.includes('settings:branches:manage');
  const canManageRoleAssignments = canManageUsers && canViewRoles;
  const canManageBranchAssignments = canManageUsers && canManageBranches;

  const usersQuery = useQuery({ queryKey: ['settings', 'users'], queryFn: usersApi.list });
  const rolesQuery = useQuery({
    queryKey: ['settings', 'roles'],
    queryFn: rolesApi.list,
    enabled: canManageRoleAssignments,
  });
  const branchesQuery = useQuery({
    queryKey: ['settings', 'branches', 'all'],
    queryFn: branchesApi.listAll,
    enabled: canManageBranchAssignments,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ user, body }: { user: ManagedUser | null; body: UserInput }) => {
      if (!user) {
        const created = await usersApi.create({
          name: body.name,
          email: body.email,
          password: body.password,
        });
        const assignments = [];
        if (canManageRoleAssignments) {
          assignments.push(usersApi.assignRoles(created.id, body.roleIds ?? []));
        }
        if (canManageBranchAssignments) {
          assignments.push(
            usersApi.assignBranches(created.id, body.branchIds ?? [], body.defaultBranchId)
          );
        }
        await Promise.all(assignments);
        return created;
      }
      await usersApi.update(user.id, {
        name: body.name,
        email: body.email,
        ...(body.password ? { password: body.password } : {}),
      });
      const assignments = [];
      if (canManageRoleAssignments) {
        assignments.push(usersApi.assignRoles(user.id, body.roleIds ?? []));
      }
      if (canManageBranchAssignments) {
        assignments.push(
          usersApi.assignBranches(user.id, body.branchIds ?? [], body.defaultBranchId)
        );
      }
      await Promise.all(assignments);
      return usersApi.list();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      toast.success(editingUser ? 'Usuario actualizado' : 'Usuario creado');
      setDialogOpen(false);
      setEditingUser(null);
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el usuario'),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      toast.success('Usuario eliminado');
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el usuario'),
  });

  const users = usersQuery.data ?? [];
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return users;
    return users.filter(user =>
      `${user.name} ${user.email} ${user.roles.join(' ')}`.toLocaleLowerCase().includes(query)
    );
  }, [search, users]);

  function openCreate() {
    setEditingUser(null);
    setDialogOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setEditingUser(user);
    setDialogOpen(true);
  }

  function saveUser(user: ManagedUser | null, body: UserInput) {
    saveMutation.mutate({ user, body });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="relative overflow-hidden rounded-2xl border bg-card p-6 md:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(ellipse_at_right,_hsl(var(--primary)/0.12),_transparent_70%)] md:block" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Control de acceso / 01
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Usuarios</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Administra quién puede entrar, qué funciones puede usar y en qué sucursales opera.
            </p>
          </div>
          {canCreateUsers && (
            <Button onClick={openCreate}>
              <Plus data-icon="inline-start" />
              Nuevo usuario
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Usuarios registrados"
          value={users.length}
          detail="Cuentas del sistema"
        />
        <SummaryCard
          label="Roles en uso"
          value={new Set(users.flatMap(user => user.roles)).size}
          detail="Perfiles de acceso asignados"
        />
        <SummaryCard
          label="Con sucursales"
          value={users.filter(user => user.branches.length > 0).length}
          detail="Acceso operativo configurado"
        />
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Directorio de usuarios</CardTitle>
            <CardDescription className="mt-2">
              {filteredUsers.length}{' '}
              {filteredUsers.length === 1 ? 'cuenta visible' : 'cuentas visibles'}
            </CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nombre, correo o rol"
              aria-label="Buscar usuarios"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Cargando usuarios...</p>
          ) : usersQuery.isError ? (
            <p role="alert" className="py-10 text-center text-sm text-destructive">
              No se pudo cargar el directorio. {usersQuery.error.message}
            </p>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="rounded-full bg-muted p-3">
                <UserRoundPen className="size-5 text-muted-foreground" />
              </div>
              <p className="font-medium">
                {search ? 'No hay coincidencias' : 'Aún no hay usuarios'}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {search
                  ? 'Prueba con otro término.'
                  : 'Crea una cuenta y asígnale su primer rol y sucursal.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Sucursales</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.length ? (
                          user.roles.map(role => (
                            <Badge key={role} variant="secondary">
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin roles</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.branches.map(branch => (
                          <span key={branch.id} className="flex items-center gap-1.5 text-sm">
                            <Building2 className="size-3.5 text-muted-foreground" />
                            {branch.name}
                            {branch.isDefault && <Badge variant="outline">Predeterminada</Badge>}
                          </span>
                        ))}
                        {user.branches.length === 0 && (
                          <span className="text-sm text-muted-foreground">Sin acceso</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {canManageUsers && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Editar ${user.name}`}
                              onClick={() => openEdit(user)}
                            >
                              <UserRoundPen />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Eliminar ${user.name}`}
                              disabled={deleteMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`¿Eliminar la cuenta de ${user.name}?`))
                                  deleteMutation.mutate(user.id);
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </>
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

      <UserDialog
        open={dialogOpen}
        user={editingUser}
        roles={rolesQuery.data ?? []}
        branches={branchesQuery.data ?? []}
        onOpenChange={setDialogOpen}
        onSave={saveUser}
        pending={saveMutation.isPending}
        canManageRoleAssignments={canManageRoleAssignments}
        canManageBranchAssignments={canManageBranchAssignments}
      />
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <Shield className="size-5 text-primary" />
      </CardContent>
    </Card>
  );
}

function UserDialog({
  open,
  user,
  roles,
  branches,
  onOpenChange,
  onSave,
  ...props
}: UserFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user ? 'Editar usuario' : 'Crear usuario'}</DialogTitle>
          <DialogDescription>
            Configura los datos de acceso, roles y sucursal predeterminada.
          </DialogDescription>
        </DialogHeader>
        <UserForm
          key={`${user?.id ?? 'new'}-${roles.length}`}
          user={user}
          roles={roles}
          branches={branches}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
          {...props}
        />
      </DialogContent>
    </Dialog>
  );
}

function UserForm({
  user,
  roles,
  branches,
  onSave,
  onCancel,
  pending,
  canManageRoleAssignments,
  canManageBranchAssignments,
}: Omit<UserFormProps, 'open' | 'onOpenChange'> & { onCancel: () => void }) {
  const [name, setName] = useState(() => user?.name ?? '');
  const [email, setEmail] = useState(() => user?.email ?? '');
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>(() =>
    roles.filter(role => user?.roles.includes(role.name)).map(role => role.id)
  );
  const [branchIds, setBranchIds] = useState<string[]>(
    () => user?.branches.map(branch => branch.id) ?? []
  );
  const [defaultBranchId, setDefaultBranchId] = useState(
    () => user?.branches.find(branch => branch.isDefault)?.id ?? ''
  );

  function toggleValue(values: string[], value: string, checked: boolean): string[] {
    return checked ? [...values, value] : values.filter(current => current !== value);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(user, {
      name,
      email,
      password,
      roleIds,
      branchIds,
      ...(defaultBranchId ? { defaultBranchId } : {}),
    });
  }

  const availableAssignedBranches = branches.filter(branch => branchIds.includes(branch.id));

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="user-name">Nombre completo</FieldLabel>
          <Input
            id="user-name"
            value={name}
            onChange={event => setName(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="user-email">Correo electrónico</FieldLabel>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="user-password">
            {user ? 'Nueva contraseña (opcional)' : 'Contraseña'}
          </FieldLabel>
          <Input
            id="user-password"
            type="password"
            minLength={6}
            value={password}
            onChange={event => setPassword(event.target.value)}
            required={!user}
            autoComplete="new-password"
          />
        </Field>
      </FieldGroup>

      {canManageRoleAssignments && (
        <FieldSet>
          <FieldLegend>Roles de acceso</FieldLegend>
          <FieldDescription>
            Los roles base no se editan aquí; puedes asignarlos o crear roles personalizados en la
            sección Roles.
          </FieldDescription>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map(role => (
              <label
                key={role.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={roleIds.includes(role.id)}
                  onCheckedChange={checked =>
                    setRoleIds(current => toggleValue(current, role.id, checked === true))
                  }
                />
                <span className="min-w-0 flex-1 truncate">{role.name}</span>
                {role.isSystem && <Badge variant="outline">Sistema</Badge>}
              </label>
            ))}
          </div>
        </FieldSet>
      )}

      {canManageBranchAssignments && (
        <FieldSet>
          <FieldLegend>Sucursales asignadas</FieldLegend>
          <FieldDescription>
            Si asignas sucursales, elige exactamente una como predeterminada.
          </FieldDescription>
          <div className="grid gap-2 sm:grid-cols-2">
            {branches
              .filter(branch => branch.isActive)
              .map(branch => (
                <label
                  key={branch.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={branchIds.includes(branch.id)}
                    onCheckedChange={checked => {
                      const selected = checked === true;
                      setBranchIds(current => toggleValue(current, branch.id, selected));
                      if (selected && !defaultBranchId) setDefaultBranchId(branch.id);
                      if (!selected && defaultBranchId === branch.id) {
                        setDefaultBranchId(branchIds.filter(id => id !== branch.id)[0] ?? '');
                      }
                    }}
                  />
                  <span className="truncate">{branch.name}</span>
                </label>
              ))}
          </div>
          {availableAssignedBranches.length > 0 && (
            <Field>
              <FieldLabel>Sucursal predeterminada</FieldLabel>
              <Select value={defaultBranchId} onValueChange={setDefaultBranchId}>
                <SelectTrigger aria-label="Sucursal predeterminada">
                  <SelectValue placeholder="Selecciona una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availableAssignedBranches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </FieldSet>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando...' : user ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </DialogFooter>
    </form>
  );
}
