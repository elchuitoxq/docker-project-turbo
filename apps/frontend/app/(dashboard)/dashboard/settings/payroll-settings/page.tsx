'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Pencil, Plus } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePayrollSettings, useUpdatePayrollSetting } from '@/modules/hr/hooks';
import type { PayrollSetting } from '@/modules/hr/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/use-auth-store';

const SETTING_TYPES = ['PERCENT', 'NUMBER', 'MONEY', 'MONEY_USD'] as const;

function formatValue(setting: PayrollSetting): string {
  if (setting.type.startsWith('PERCENT')) return `${setting.value} %`;
  return setting.value.toLocaleString('es-VE', { maximumFractionDigits: 4 });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' });
}

export default function PayrollSettingsPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canView = permissions.includes(PERMISSIONS.HR.SETTINGS.VIEW);
  const canManage = permissions.includes(PERMISSIONS.HR.SETTINGS.MANAGE);

  const [asOf, setAsOf] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollSetting | null>(null);

  const settingsQuery = usePayrollSettings(asOf || undefined);
  const updateSetting = useUpdatePayrollSetting();
  const settings = settingsQuery.data ?? [];

  const openDialog = (setting: PayrollSetting | null) => {
    setEditing(setting);
    setDialogOpen(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const key = String(form.get('key') ?? editing?.key ?? '');
    const value = Number(form.get('value'));

    if (!key) {
      toast.error('Indique la clave del parámetro');
      return;
    }
    if (!Number.isFinite(value)) {
      toast.error('El valor debe ser numérico');
      return;
    }

    updateSetting.mutate(
      {
        key,
        value,
        type: String(form.get('type') ?? editing?.type ?? 'NUMBER'),
        label: String(form.get('label') ?? '') || undefined,
        effectiveFrom: String(form.get('effectiveFrom') ?? '') || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Parámetro guardado para esa vigencia');
          setDialogOpen(false);
          setEditing(null);
        },
        onError: error =>
          toast.error(error instanceof Error ? error.message : 'No se pudo guardar el parámetro'),
      }
    );
  };

  if (!canView) {
    return (
      <Card role="alert" className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Sin acceso</CardTitle>
          <CardDescription>No tienes permiso para ver los parámetros de nómina.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Parámetros de nómina</h1>
          <p className="text-muted-foreground text-sm">
            Alícuotas, topes y montos legales con su fecha de vigencia. Cambiar un parámetro{' '}
            <strong>no</strong> altera las nóminas ya generadas: cada run guarda su propia copia.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs" htmlFor="asOf">
              Vigentes al
            </label>
            <Input
              id="asOf"
              type="date"
              value={asOf}
              onChange={event => setAsOf(event.target.value)}
              className="w-40"
            />
          </div>
          {canManage ? (
            <Button onClick={() => openDialog(null)}>
              <Plus data-icon="inline-start" />
              Nuevo parámetro
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="text-muted-foreground" />
            Vigencia consultada
          </CardTitle>
          <CardDescription>
            {asOf ? `Parámetros vigentes al ${formatDate(asOf)}` : 'Parámetros vigentes hoy'} ·{' '}
            {settings.length} claves
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : settings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay parámetros vigentes para esa fecha. Carga uno nuevo o revisa la vigencia.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clave</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vigente desde</TableHead>
                  <TableHead>Alcance</TableHead>
                  {canManage ? <TableHead className="text-right">Acciones</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.map(setting => (
                  <TableRow key={setting.id}>
                    <TableCell className="font-mono text-xs">{setting.key}</TableCell>
                    <TableCell>{setting.label}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{setting.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatValue(setting)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(setting.effectiveFrom)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={setting.branchId ? 'outline' : 'secondary'}>
                        {setting.branchId ? 'Sucursal' : 'Empresa'}
                      </Badge>
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDialog(setting)}>
                          <Pencil data-icon="inline-start" />
                          Nueva vigencia
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Vigencia de ${editing.key}` : 'Nuevo parámetro'}</DialogTitle>
            <DialogDescription>
              Un parámetro se guarda por fecha de vigencia. Si ya existe una vigencia en esa fecha
              se actualiza; si no, se crea una nueva.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="key">Clave</FieldLabel>
                <Input
                  id="key"
                  name="key"
                  defaultValue={editing?.key ?? ''}
                  readOnly={!!editing}
                  placeholder="SSO_EMP"
                  className="font-mono"
                  required
                />
                <FieldDescription>
                  Mayúsculas, números y guion bajo. Los porcentajes se cargan como porcentaje entero
                  (4 = 4 %).
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="label">Descripción</FieldLabel>
                <Input
                  id="label"
                  name="label"
                  defaultValue={editing?.label ?? ''}
                  placeholder="Seguro social trabajador (%)"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="type">Tipo</FieldLabel>
                <Select name="type" defaultValue={editing?.type ?? 'NUMBER'}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SETTING_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  <code>MONEY_USD</code> indica un monto en divisa: el motor lo convierte a la
                  moneda de la nómina con la tasa del período.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="value">Valor</FieldLabel>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  step="0.0001"
                  defaultValue={editing?.value ?? ''}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="effectiveFrom">Vigente desde</FieldLabel>
                <Input
                  id="effectiveFrom"
                  name="effectiveFrom"
                  type="date"
                  defaultValue={editing ? editing.effectiveFrom.slice(0, 10) : ''}
                />
                <FieldDescription>Sin fecha se usa el día de hoy.</FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateSetting.isPending}>
                {updateSetting.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
