'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { formatMoney } from '@/lib/utils';
import { taxConceptsApi, type TaxConcept } from '../api';

/**
 * Conceptos de impuesto y retención (`settings:taxes:*`).
 *
 * Cada concepto define el porcentaje que se retiene al proveedor sobre la base del pago; el partner
 * lo referencia con `islr_concept_id`. Desactivar un concepto lo saca de las nuevas compras sin
 * romper las retenciones ya emitidas.
 */
export function TaxConceptsView() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSIONS.SETTINGS.TAXES.MANAGE);
  const [search, setSearch] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<TaxConcept | null>(null);

  const concepts = useQuery({
    queryKey: ['settings', 'tax-concepts'],
    queryFn: taxConceptsApi.list,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['settings', 'tax-concepts'] });

  const update = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      taxConceptsApi.update(id, { isEnabled }),
    onSuccess: async () => {
      await invalidate();
      toast.success('Concepto actualizado');
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el concepto'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => taxConceptsApi.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Concepto eliminado');
    },
    onError: error =>
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo eliminar: puede estar en uso por un proveedor'
      ),
  });

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = concepts.data ?? [];

    if (!term) return list;

    return list.filter(
      concept =>
        concept.name.toLowerCase().includes(term) || concept.code.toLowerCase().includes(term)
    );
  }, [concepts.data, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conceptos de impuestos</h1>
          <p className="text-sm text-muted-foreground">
            Retención de ISLR por concepto: porcentaje, base mínima y sustraendo
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            Nuevo concepto
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
            aria-label="Buscar concepto"
          />
        </div>
      </ListFilters>

      <ListCard
        title={
          <>
            <Receipt className="size-4" /> {rows.length} conceptos
          </>
        }
        description="El porcentaje se aplica sobre la base del pago; el sustraendo se resta del resultado. El concepto del proveedor manda sobre los parámetros de la empresa"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ListTh>Código</ListTh>
              <ListTh>Concepto</ListTh>
              <ListTh align="right">Retención</ListTh>
              <ListTh align="right" hide="md">
                Base mínima
              </ListTh>
              <ListTh align="right" hide="sm">
                Sustraendo
              </ListTh>
              <ListTh>Estado</ListTh>
              <ListTh align="right">Acciones</ListTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {concepts.isLoading ? (
              <ListSkeletonRows rows={4} cols={7} />
            ) : rows.length === 0 ? (
              <ListEmptyRow
                cols={7}
                message={
                  search ? 'Ningún concepto coincide con la búsqueda' : 'Todavía no hay conceptos'
                }
                hint={search ? undefined : 'Sin conceptos, los proveedores no pueden retener ISLR'}
              />
            ) : (
              rows.map(concept => (
                <TableRow key={concept.id}>
                  <ListTd mono>{concept.code}</ListTd>
                  <ListTd className="font-medium">{concept.name}</ListTd>
                  <ListTd numeric>{`${concept.retentionPercentage} %`}</ListTd>
                  <ListTd numeric hide="md">
                    {formatMoney(concept.baseMin ?? 0, 'VES')}
                  </ListTd>
                  <ListTd numeric hide="sm">
                    {concept.sustraendoUnit === 'UT'
                      ? `${concept.sustraendo ?? 0} UT`
                      : formatMoney(concept.sustraendo ?? 0, 'VES')}
                  </ListTd>
                  <ListTd>
                    <Badge variant={concept.isEnabled ? 'default' : 'secondary'}>
                      {concept.isEnabled ? 'Habilitado' : 'Deshabilitado'}
                    </Badge>
                  </ListTd>
                  <ListTd align="right">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <Switch
                          checked={concept.isEnabled}
                          disabled={update.isPending}
                          onCheckedChange={checked =>
                            update.mutate({ id: concept.id, isEnabled: checked })
                          }
                          aria-label={`Habilitar ${concept.name}`}
                        />
                      )}
                      <ListRowActions label={`Acciones de ${concept.name}`}>
                        <DropdownMenuItem disabled={!canManage} onClick={() => setEditing(concept)}>
                          <Pencil />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={!canManage || remove.isPending}
                          onClick={() => remove.mutate(concept.id)}
                        >
                          <Trash2 />
                          Eliminar
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
        <TaxConceptDialog
          concept={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={async () => {
            setCreating(false);
            setEditing(null);
            await invalidate();
          }}
        />
      )}
    </div>
  );
}

function TaxConceptDialog({
  concept,
  onClose,
  onDone,
}: {
  concept: TaxConcept | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [code, setCode] = React.useState(concept?.code ?? '');
  const [name, setName] = React.useState(concept?.name ?? '');
  const [percentage, setPercentage] = React.useState(
    concept ? String(concept.retentionPercentage) : ''
  );
  const [baseMin, setBaseMin] = React.useState(concept ? String(concept.baseMin ?? 0) : '0');
  const [sustraendo, setSustraendo] = React.useState(
    concept ? String(concept.sustraendo ?? 0) : '0'
  );
  const [sustraendoUnit, setSustraendoUnit] = React.useState<'BS' | 'UT'>(
    concept?.sustraendoUnit ?? 'BS'
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        retentionPercentage: Number(percentage),
        baseMin: Number(baseMin || 0),
        sustraendo: Number(sustraendo || 0),
        sustraendoUnit,
      };

      return concept
        ? taxConceptsApi.update(concept.id, payload)
        : taxConceptsApi.create({ ...payload, isEnabled: true });
    },
    onSuccess: async () => {
      toast.success(concept ? 'Concepto actualizado' : 'Concepto creado');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el concepto'),
  });

  const numericValid =
    percentage.trim() !== '' && Number(percentage) >= 0 && Number(percentage) <= 100;
  const valid = code.trim().length > 0 && name.trim().length > 0 && numericValid;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{concept ? 'Editar concepto' : 'Nuevo concepto de impuesto'}</DialogTitle>
          <DialogDescription>
            La retención se calcula como base × porcentaje − sustraendo, sin bajar de cero
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="concept-code">Código</FieldLabel>
            <Input
              id="concept-code"
              value={code}
              onChange={event => setCode(event.target.value)}
              placeholder="ISLR-001"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="concept-name">Concepto</FieldLabel>
            <Input
              id="concept-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Honorarios profesionales"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="concept-percentage">Porcentaje de retención</FieldLabel>
            <Input
              id="concept-percentage"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={percentage}
              onChange={event => setPercentage(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="concept-base">Base mínima</FieldLabel>
            <Input
              id="concept-base"
              type="number"
              min={0}
              step="0.01"
              value={baseMin}
              onChange={event => setBaseMin(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="concept-sustraendo">Sustraendo</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="concept-sustraendo"
                type="number"
                min={0}
                step="0.01"
                value={sustraendo}
                onChange={event => setSustraendo(event.target.value)}
                className="flex-1"
              />
              <Select
                value={sustraendoUnit}
                onValueChange={v => setSustraendoUnit(v as 'BS' | 'UT')}
              >
                <SelectTrigger id="concept-sustraendo-unit" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BS">Bs</SelectItem>
                  <SelectItem value="UT">UT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              En UT se convierte con la unidad tributaria vigente a la fecha de la compra.
            </p>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            {concept ? 'Guardar cambios' : 'Crear concepto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
