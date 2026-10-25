'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import { branchesApi, type Branch, type Company } from '@/modules/branches/api';
import { useAuthStore } from '@/stores/use-auth-store';
import { PERMISSIONS } from '@/lib/permissions';

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canManageCompanies = permissions.includes(PERMISSIONS.SETTINGS.COMPANIES.MANAGE);
  const canViewCompanies =
    canManageCompanies || permissions.includes(PERMISSIONS.SETTINGS.COMPANIES.VIEW);
  const canManageBranches = permissions.includes(PERMISSIONS.SETTINGS.BRANCHES.MANAGE);
  const canViewBranches =
    canManageBranches || permissions.includes(PERMISSIONS.SETTINGS.BRANCHES.VIEW);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const companiesQuery = useQuery({
    queryKey: ['settings', 'companies', canManageCompanies ? 'all' : 'accessible'],
    queryFn: canManageCompanies ? branchesApi.listAllCompanies : branchesApi.listCompanies,
    enabled: canViewCompanies,
  });
  const branchesQuery = useQuery({
    queryKey: ['settings', 'branches', canManageBranches ? 'all' : 'accessible'],
    queryFn: canManageBranches ? branchesApi.listAll : branchesApi.list,
    enabled: canViewBranches,
  });
  const companies = companiesQuery.data ?? [];
  const branches = branchesQuery.data ?? [];
  const branchesByCompany = useMemo(
    () => new Map(companies.map(company => [company.id, company.name])),
    [companies]
  );
  const hasStructureAccess = canViewCompanies || canViewBranches;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['settings', 'companies'] }),
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] }),
      queryClient.invalidateQueries({ queryKey: ['companies'] }),
      queryClient.invalidateQueries({ queryKey: ['branches'] }),
    ]);
  };

  const saveCompany = useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: CompanyFormValue }) =>
      id ? branchesApi.updateCompany(id, body) : branchesApi.createCompany(body),
    onSuccess: async () => {
      await refresh();
      toast.success(editingCompany ? 'Empresa actualizada' : 'Empresa creada');
      setCompanyDialogOpen(false);
      setEditingCompany(null);
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la empresa'),
  });

  const saveBranch = useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: BranchFormValue }) =>
      id ? branchesApi.update(id, body) : branchesApi.create(body),
    onSuccess: async () => {
      await refresh();
      toast.success(editingBranch ? 'Sucursal actualizada' : 'Sucursal creada');
      setBranchDialogOpen(false);
      setEditingBranch(null);
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la sucursal'),
  });

  const deactivateBranch = useMutation({
    mutationFn: branchesApi.remove,
    onSuccess: async () => {
      await refresh();
      toast.success('Sucursal desactivada');
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo desactivar la sucursal'),
  });

  if (!hasStructureAccess) {
    return (
      <Card role="alert" className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
          <CardDescription>
            No tienes permisos para consultar empresas ni sucursales.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <header className="relative overflow-hidden rounded-2xl border bg-card p-6 md:p-8">
        <div className="absolute -right-8 -top-12 size-56 rounded-full border-[24px] border-primary/5" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Estructura organizacional / 01
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Empresas y sucursales
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Las empresas son entidades propias. Agrupa bajo cada una sus sucursales, sin depender
              del RIF como identificador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageCompanies && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingCompany(null);
                  setCompanyDialogOpen(true);
                }}
              >
                <Plus data-icon="inline-start" />
                Nueva empresa
              </Button>
            )}
            {canManageBranches && (
              <Button
                onClick={() => {
                  setEditingBranch(null);
                  setBranchDialogOpen(true);
                }}
                disabled={!canViewCompanies || !companies.some(company => company.isActive)}
              >
                <MapPin data-icon="inline-start" />
                Nueva sucursal
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {canViewCompanies && (
          <StructureCard
            label="Empresas"
            value={companies.length}
            detail="Registros legales"
            icon={<Building2 className="size-5 text-primary" />}
          />
        )}
        {canViewBranches && (
          <>
            <StructureCard
              label="Sucursales"
              value={branches.length}
              detail="Puntos operativos"
              icon={<MapPin className="size-5 text-primary" />}
            />
            <StructureCard
              label="Activas"
              value={branches.filter(branch => branch.isActive).length}
              detail="Sucursales disponibles"
              icon={<Building2 className="size-5 text-primary" />}
            />
          </>
        )}
      </div>

      {canViewCompanies && (
        <Card>
          <CardHeader>
            <CardTitle>Empresas</CardTitle>
            <CardDescription>
              Identidad legal y datos de contacto que comparten las sucursales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {companiesQuery.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Cargando empresas...</p>
            ) : companiesQuery.isError ? (
              <p role="alert" className="py-8 text-center text-sm text-destructive">
                {companiesQuery.error.message}
              </p>
            ) : companies.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Todavía no hay empresas. Crea una para registrar sucursales.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>RIF</TableHead>
                    <TableHead>Sucursales</TableHead>
                    <TableHead>Estado</TableHead>
                    {canManageCompanies && (
                      <TableHead className="w-20 text-right">Editar</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map(company => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <p className="font-medium">{company.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {company.email ||
                            company.phone ||
                            company.address ||
                            'Sin datos de contacto'}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {company.taxId || 'Sin RIF'}
                      </TableCell>
                      <TableCell>{company.branchCount}</TableCell>
                      <TableCell>
                        <Badge variant={company.isActive ? 'secondary' : 'outline'}>
                          {company.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      {canManageCompanies && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${company.name}`}
                            onClick={() => {
                              setEditingCompany(company);
                              setCompanyDialogOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {canViewBranches && (
        <Card>
          <CardHeader>
            <CardTitle>Sucursales</CardTitle>
            <CardDescription>
              Los usuarios solo pueden operar en las sucursales que tengan asignadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {branchesQuery.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Cargando sucursales...
              </p>
            ) : branchesQuery.isError ? (
              <p role="alert" className="py-8 text-center text-sm text-destructive">
                {branchesQuery.error.message}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sucursal</TableHead>
                    {canViewCompanies && <TableHead>Empresa</TableHead>}
                    <TableHead>Ubicación y contacto</TableHead>
                    <TableHead>Estado</TableHead>
                    {canManageBranches && (
                      <TableHead className="w-24 text-right">Acciones</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map(branch => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      {canViewCompanies && (
                        <TableCell>
                          {branchesByCompany.get(branch.companyId) ?? 'Empresa no encontrada'}
                        </TableCell>
                      )}
                      <TableCell>
                        <span className="block text-sm">{branch.address || 'Sin dirección'}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {branch.phone || branch.email || 'Sin contacto'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={branch.isActive ? 'secondary' : 'outline'}>
                          {branch.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      {canManageBranches && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Editar ${branch.name}`}
                              disabled={!canViewCompanies}
                              onClick={() => {
                                setEditingBranch(branch);
                                setBranchDialogOpen(true);
                              }}
                            >
                              <Pencil />
                            </Button>
                            {branch.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Desactivar ${branch.name}`}
                                disabled={deactivateBranch.isPending}
                                onClick={() => {
                                  if (window.confirm(`¿Desactivar la sucursal ${branch.name}?`)) {
                                    deactivateBranch.mutate(branch.id);
                                  }
                                }}
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {branches.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={3 + Number(canViewCompanies) + Number(canManageBranches)}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Aún no hay sucursales.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {canManageCompanies && (
        <CompanyDialog
          open={companyDialogOpen}
          company={editingCompany}
          pending={saveCompany.isPending}
          onOpenChange={setCompanyDialogOpen}
          onSave={body => saveCompany.mutate({ id: editingCompany?.id ?? null, body })}
        />
      )}
      {canManageBranches && (
        <BranchDialog
          open={branchDialogOpen}
          branch={editingBranch}
          companies={companies.filter(
            company => company.isActive || company.id === editingBranch?.companyId
          )}
          pending={saveBranch.isPending}
          onOpenChange={setBranchDialogOpen}
          onSave={body => saveBranch.mutate({ id: editingBranch?.id ?? null, body })}
        />
      )}
    </div>
  );
}

type CompanyFormValue = {
  name: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
};

type BranchFormValue = {
  companyId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
};

function StructureCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function CompanyDialog({
  open,
  company,
  pending,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  company: Company | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (body: CompanyFormValue) => void;
}) {
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? '');
    setTaxId(company?.taxId ?? '');
    setAddress(company?.address ?? '');
    setPhone(company?.phone ?? '');
    setEmail(company?.email ?? '');
    setIsActive(company?.isActive ?? true);
  }, [open, company]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle>
          <DialogDescription>
            El RIF es un dato legal, no la clave de agrupación de la empresa.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={event => {
            event.preventDefault();
            onSave({
              name: name.trim(),
              ...(taxId.trim() ? { taxId: taxId.trim() } : {}),
              ...(address.trim() ? { address: address.trim() } : {}),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
              ...(email.trim() ? { email: email.trim() } : {}),
              isActive,
            });
          }}
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="company-name">Razón social</FieldLabel>
              <Input
                id="company-name"
                value={name}
                onChange={event => setName(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="company-tax-id">RIF (opcional)</FieldLabel>
              <Input
                id="company-tax-id"
                value={taxId}
                onChange={event => setTaxId(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="company-address">Dirección</FieldLabel>
              <Input
                id="company-address"
                value={address}
                onChange={event => setAddress(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="company-phone">Teléfono</FieldLabel>
                <Input
                  id="company-phone"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-email">Correo</FieldLabel>
                <Input
                  id="company-email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                />
              </Field>
            </div>
            {company && (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3">
                <Checkbox
                  checked={isActive}
                  onCheckedChange={checked => setIsActive(checked === true)}
                />
                <span className="text-sm">Empresa activa</span>
              </label>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando...' : 'Guardar empresa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BranchDialog({
  open,
  branch,
  companies,
  pending,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  branch: Branch | null;
  companies: Company[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (body: BranchFormValue) => void;
}) {
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!open) return;
    setCompanyId(branch?.companyId ?? companies[0]?.id ?? '');
    setName(branch?.name ?? '');
    setAddress(branch?.address ?? '');
    setPhone(branch?.phone ?? '');
    setEmail(branch?.email ?? '');
  }, [open, branch, companies]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{branch ? 'Editar sucursal' : 'Nueva sucursal'}</DialogTitle>
          <DialogDescription>Selecciona a qué empresa legal pertenece esta sede.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={event => {
            event.preventDefault();
            onSave({
              companyId,
              name: name.trim(),
              ...(address.trim() ? { address: address.trim() } : {}),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
              ...(email.trim() ? { email: email.trim() } : {}),
            });
          }}
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Empresa</FieldLabel>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger aria-label="Empresa de la sucursal">
                  <SelectValue placeholder="Selecciona una empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="branch-name">Nombre de sucursal</FieldLabel>
              <Input
                id="branch-name"
                value={name}
                onChange={event => setName(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="branch-address">Dirección</FieldLabel>
              <Input
                id="branch-address"
                value={address}
                onChange={event => setAddress(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="branch-phone">Teléfono</FieldLabel>
                <Input
                  id="branch-phone"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="branch-email">Correo</FieldLabel>
                <Input
                  id="branch-email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !companyId}>
              {pending ? 'Guardando...' : 'Guardar sucursal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
