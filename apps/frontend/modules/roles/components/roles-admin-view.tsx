'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
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
import { rolesApi, type ManagedRole, type Permission } from '../api';
import { useAuthStore } from '@/stores/use-auth-store';

export function RolesAdminView() {
  const queryClient = useQueryClient();
  const userPermissions = useAuthStore(state => state.user?.permissions ?? []);
  const canManageRoles = userPermissions.includes('settings:roles:manage');
  const rolesQuery = useQuery({ queryKey: ['settings', 'roles'], queryFn: rolesApi.list });
  const permissionsQuery = useQuery({
    queryKey: ['settings', 'roles', 'permissions'],
    queryFn: rolesApi.listPermissions,
  });
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    roleId: string;
    permissionIds: string[];
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const roleList = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const activeRole = roleList.find(role => role.id === activeRoleId) ?? roleList[0] ?? null;
  const activeRolePermissionIds = useMemo(
    () => activeRole?.permissions.map(permission => permission.id) ?? [],
    [activeRole]
  );
  const selectedPermissionIds =
    pendingSelection && pendingSelection.roleId === activeRole?.id
      ? pendingSelection.permissionIds
      : activeRolePermissionIds;
  const permissionGroups = useMemo(
    () =>
      permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
        (groups[permission.module] ??= []).push(permission);
        return groups;
      }, {}),
    [permissions]
  );

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; permissionIds: string[] }) =>
      rolesApi.update(input.id, { permissionIds: input.permissionIds }),
    onSuccess: async role => {
      setPendingSelection(null);
      await queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      toast.success(`Permisos actualizados para ${role.name}`);
    },
    onError: error =>
      toast.error(
        error instanceof Error ? error.message : 'No se pudieron actualizar los permisos'
      ),
  });

  const createMutation = useMutation({
    mutationFn: rolesApi.create,
    onSuccess: async role => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      setActiveRoleId(role.id);
      setPendingSelection(null);
      setCreateOpen(false);
      toast.success('Rol personalizado creado');
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el rol'),
  });

  const deleteMutation = useMutation({
    mutationFn: rolesApi.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      setActiveRoleId(null);
      setPendingSelection(null);
      toast.success('Rol eliminado');
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el rol'),
  });

  function togglePermission(id: string, checked: boolean) {
    if (!activeRole) return;
    setPendingSelection({
      roleId: activeRole.id,
      permissionIds: checked
        ? [...selectedPermissionIds, id]
        : selectedPermissionIds.filter(permissionId => permissionId !== id),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="relative overflow-hidden rounded-2xl border bg-card p-6 md:p-8">
        <div className="absolute right-8 top-8 hidden rounded-full border border-primary/20 p-4 text-primary md:block">
          <ShieldCheck className="size-7" />
        </div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Control de acceso / 02
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Roles y permisos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Define capacidades por perfil. Los roles de sistema permanecen protegidos; los roles
          personalizados pueden ajustarse y eliminarse.
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Perfiles</CardTitle>
              <CardDescription className="mt-1">
                {roleList.length} roles disponibles
              </CardDescription>
            </div>
            {canManageRoles && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Crear rol"
                onClick={() => setCreateOpen(true)}
              >
                <Plus />
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {rolesQuery.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Cargando roles...</p>
            ) : rolesQuery.isError ? (
              <p role="alert" className="py-6 text-sm text-destructive">
                {rolesQuery.error.message}
              </p>
            ) : (
              roleList.map(role => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    setActiveRoleId(role.id);
                    setPendingSelection(null);
                  }}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    activeRole?.id === role.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="truncate text-sm font-medium">{role.name}</span>
                  {role.isSystem ? (
                    <LockKeyhole className="size-4 shrink-0" />
                  ) : (
                    <Badge variant={activeRole?.id === role.id ? 'secondary' : 'outline'}>
                      Personalizado
                    </Badge>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          {activeRole ? (
            <>
              <CardHeader className="flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{activeRole.name}</CardTitle>
                    {activeRole.isSystem ? (
                      <Badge variant="secondary">Rol de sistema</Badge>
                    ) : (
                      <Badge variant="outline">Personalizado</Badge>
                    )}
                  </div>
                  <CardDescription className="mt-2">
                    {activeRole.description || 'Sin descripción'} · {activeRole.permissions.length}{' '}
                    permisos concedidos
                  </CardDescription>
                </div>
                {canManageRoles && !activeRole.isSystem && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar el rol ${activeRole.name}?`)) {
                          deleteMutation.mutate(activeRole.id);
                        }
                      }}
                    >
                      <Trash2 data-icon="inline-start" />
                      Eliminar
                    </Button>
                    <Button
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({
                          id: activeRole.id,
                          permissionIds: selectedPermissionIds,
                        })
                      }
                    >
                      <Save data-icon="inline-start" />
                      {updateMutation.isPending ? 'Guardando...' : 'Guardar permisos'}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {permissionsQuery.isLoading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Cargando catálogo de permisos...
                  </p>
                ) : permissionsQuery.isError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {permissionsQuery.error.message}
                  </p>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {Object.entries(permissionGroups).map(([module, modulePermissions]) => (
                      <FieldSet key={module} className="rounded-xl border p-4">
                        <FieldLegend className="capitalize">
                          {module}{' '}
                          <span className="ml-1 font-normal text-muted-foreground">
                            ({modulePermissions.length})
                          </span>
                        </FieldLegend>
                        <div className="mt-2 flex flex-col gap-1">
                          {modulePermissions.map(permission => {
                            const granted = activeRole.permissions.some(
                              item => item.id === permission.id
                            );
                            const checked = activeRole.isSystem
                              ? granted
                              : selectedPermissionIds.includes(permission.id);
                            return (
                              <label
                                key={permission.id}
                                className={`flex min-h-10 items-start gap-3 rounded-md px-2 py-2 text-sm ${
                                  activeRole.isSystem
                                    ? 'cursor-default'
                                    : 'cursor-pointer hover:bg-muted/60'
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={activeRole.isSystem || !canManageRoles}
                                  onCheckedChange={value =>
                                    togglePermission(permission.id, value === true)
                                  }
                                />
                                <span className="min-w-0">
                                  <span className="block break-all font-mono text-xs">
                                    {permission.code}
                                  </span>
                                  {permission.description && (
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      {permission.description}
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </FieldSet>
                    ))}
                  </div>
                )}
                {activeRole.isSystem && (
                  <p className="text-xs text-muted-foreground">
                    Los grants de roles de sistema los mantiene la seed RBAC y no se pueden cambiar
                    desde el panel.
                  </p>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Selecciona un rol para revisar sus permisos.
            </CardContent>
          )}
        </Card>
      </div>

      {canManageRoles && (
        <CreateRoleDialog
          open={createOpen}
          permissions={permissions}
          pending={createMutation.isPending}
          onOpenChange={setCreateOpen}
          onCreate={body => createMutation.mutate(body)}
        />
      )}
    </div>
  );
}

function CreateRoleDialog({
  open,
  permissions,
  pending,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  permissions: Permission[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: { name: string; description?: string; permissionIds?: string[] }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo rol personalizado</DialogTitle>
          <DialogDescription>Los roles base no pueden duplicarse ni modificarse.</DialogDescription>
        </DialogHeader>
        <CreateRoleForm
          permissions={permissions}
          pending={pending}
          onCancel={() => onOpenChange(false)}
          onCreate={onCreate}
        />
      </DialogContent>
    </Dialog>
  );
}

function CreateRoleForm({
  permissions,
  pending,
  onCancel,
  onCreate,
}: {
  permissions: Permission[];
  pending: boolean;
  onCancel: () => void;
  onCreate: (body: { name: string; description?: string; permissionIds?: string[] }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissionIds, setPermissionIds] = useState<string[]>([]);

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        onCreate({
          name: name.trim().toUpperCase().replace(/\s+/g, '_'),
          description: description.trim() || undefined,
          permissionIds,
        });
      }}
      className="flex flex-col gap-5"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="role-name">Nombre del rol</FieldLabel>
          <Input
            id="role-name"
            value={name}
            onChange={event => setName(event.target.value)}
            minLength={2}
            required
          />
          <FieldDescription>Se normaliza a mayúsculas y guiones bajos.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="role-description">Descripción</FieldLabel>
          <Input
            id="role-description"
            value={description}
            onChange={event => setDescription(event.target.value)}
          />
        </Field>
      </FieldGroup>
      <FieldSet>
        <FieldLegend>Permisos iniciales</FieldLegend>
        <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
          {permissions.map(permission => (
            <label
              key={permission.id}
              className="flex min-h-10 cursor-pointer items-center gap-2 text-xs"
            >
              <Checkbox
                checked={permissionIds.includes(permission.id)}
                onCheckedChange={checked =>
                  setPermissionIds(current =>
                    checked === true
                      ? [...current, permission.id]
                      : current.filter(id => id !== permission.id)
                  )
                }
              />
              <span className="break-all font-mono">{permission.code}</span>
            </label>
          ))}
        </div>
      </FieldSet>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creando...' : 'Crear rol'}
        </Button>
      </DialogFooter>
    </form>
  );
}
