'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';
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
import {
  useCreatePayrollConcept,
  useDeletePayrollConcept,
  usePayrollConcepts,
  useUpdatePayrollConcept,
} from '@/modules/hr/hooks';
import type { ConceptCategory, ConceptKind, PayrollConcept } from '@/modules/hr/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/use-auth-store';

const CATEGORIES: Array<{ value: ConceptCategory; label: string }> = [
  { value: 'ASSIGNMENT', label: 'Asignación' },
  { value: 'DEDUCTION', label: 'Deducción' },
  { value: 'EMPLOYER_CONTRIBUTION', label: 'Aporte patronal' },
  { value: 'INFORMATIVE', label: 'Informativo' },
];

const KINDS: Array<{ value: ConceptKind; label: string }> = [
  { value: 'FIXED', label: 'Monto fijo' },
  { value: 'PERCENT', label: 'Porcentaje' },
  { value: 'FORMULA', label: 'Fórmula' },
  { value: 'BASE', label: 'Base de cálculo' },
];

const CATEGORY_VARIANT: Record<ConceptCategory, 'default' | 'secondary' | 'outline'> = {
  ASSIGNMENT: 'default',
  DEDUCTION: 'secondary',
  EMPLOYER_CONTRIBUTION: 'outline',
  INFORMATIVE: 'outline',
};

function categoryLabel(category: ConceptCategory): string {
  return CATEGORIES.find(item => item.value === category)?.label ?? category;
}

export default function PayrollConceptsPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canView = permissions.includes(PERMISSIONS.HR.CONCEPTS.VIEW);
  const canManage = permissions.includes(PERMISSIONS.HR.CONCEPTS.MANAGE);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollConcept | null>(null);
  const [kind, setKind] = useState<ConceptKind>('FIXED');

  const conceptsQuery = usePayrollConcepts();
  const createConcept = useCreatePayrollConcept();
  const updateConcept = useUpdatePayrollConcept();
  const deleteConcept = useDeletePayrollConcept();

  const concepts = useMemo(
    () => [...(conceptsQuery.data ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
    [conceptsQuery.data]
  );

  const openDialog = (concept: PayrollConcept | null) => {
    setEditing(concept);
    setKind(concept?.kind ?? 'FIXED');
    setDialogOpen(true);
  };

  const handleDelete = (concept: PayrollConcept) => {
    deleteConcept.mutate(concept.id, {
      onSuccess: () => toast.success(`Concepto ${concept.code} eliminado`),
      onError: error =>
        toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el concepto'),
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expression = String(form.get('expression') ?? '').trim();
    const body = {
      code: String(form.get('code') ?? '')
        .trim()
        .toUpperCase(),
      name: String(form.get('name') ?? '').trim(),
      category: String(form.get('category') ?? 'ASSIGNMENT') as ConceptCategory,
      kind,
      expression: expression || null,
      affectsIntegralSalary: form.get('affectsIntegralSalary') === 'on',
      isSalarial: form.get('isSalarial') === 'on',
    };

    if (kind === 'FORMULA' && !body.expression) {
      toast.error('Un concepto con fórmula necesita la expresión');
      return;
    }

    const onSuccess = () => {
      toast.success(editing ? 'Concepto actualizado' : 'Concepto creado');
      setDialogOpen(false);
      setEditing(null);
    };
    const onError = (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el concepto');

    if (editing) {
      updateConcept.mutate({ id: editing.id, body }, { onSuccess, onError });
    } else {
      createConcept.mutate(body, { onSuccess, onError });
    }
  };

  if (!canView) {
    return (
      <Card role="alert" className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Sin acceso</CardTitle>
          <CardDescription>No tienes permiso para ver los conceptos de nómina.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Conceptos de nómina</h1>
          <p className="text-muted-foreground text-sm">
            Cada concepto declara cómo se calcula. El motor lo resuelve en la pasada que corresponda
            según las bases que use; agregar uno no exige tocar el sistema.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => openDialog(null)}>
            <Plus data-icon="inline-start" />
            Nuevo concepto
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="text-muted-foreground" />
            Catálogo de la empresa
          </CardTitle>
          <CardDescription>
            {concepts.length} conceptos · los del sistema no se eliminan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conceptsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : concepts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay conceptos cargados. Ejecuta el seed del catálogo o crea uno nuevo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Naturaleza</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fórmula</TableHead>
                  <TableHead>Integral</TableHead>
                  {canManage ? <TableHead className="text-right">Acciones</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {concepts.map(concept => (
                  <TableRow key={concept.id}>
                    <TableCell className="font-mono text-xs">{concept.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {concept.name}
                        {concept.isSystem ? <Badge variant="outline">sistema</Badge> : null}
                        {!concept.isSalarial ? <Badge variant="outline">no salarial</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={CATEGORY_VARIANT[concept.category]}>
                        {categoryLabel(concept.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{concept.kind}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs">
                      {concept.expression ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {concept.affectsIntegralSalary ? 'Sí' : 'No'}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDialog(concept)}>
                            <Pencil data-icon="inline-start" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={concept.isSystem || deleteConcept.isPending}
                            onClick={() => handleDelete(concept)}
                          >
                            <Trash2 data-icon="inline-start" />
                            Eliminar
                          </Button>
                        </div>
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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Concepto ${editing.code}` : 'Nuevo concepto'}</DialogTitle>
            <DialogDescription>
              La fórmula se valida al guardar: sólo admite números, bases de cálculo, claves de
              parámetro de la empresa, operadores y paréntesis.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="code">Código</FieldLabel>
                <Input
                  id="code"
                  name="code"
                  defaultValue={editing?.code ?? ''}
                  readOnly={!!editing}
                  placeholder="PRIMA_ANTIGUEDAD"
                  className="font-mono"
                  required
                />
                <FieldDescription>
                  Mayúsculas, números y guion bajo. No se puede cambiar después de crear.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="name">Nombre</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editing?.name ?? ''}
                  placeholder="Prima de antigüedad"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="category">Naturaleza</FieldLabel>
                <Select name="category" defaultValue={editing?.category ?? 'ASSIGNMENT'}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Naturaleza" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CATEGORIES.map(item => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  El aporte patronal es costo del empleador: no reduce el neto del trabajador.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="kind">Tipo de cálculo</FieldLabel>
                <Select
                  name="kind"
                  value={kind}
                  onValueChange={value => setKind(value as ConceptKind)}
                >
                  <SelectTrigger id="kind">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {KINDS.map(item => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="expression">Fórmula</FieldLabel>
                <Input
                  id="expression"
                  name="expression"
                  defaultValue={editing?.expression ?? ''}
                  placeholder="BASE_IVSS * SSO_EMP / 100"
                  className="font-mono"
                  disabled={kind !== 'FORMULA'}
                />
                <FieldDescription>
                  Bases disponibles: <code>SALARY_BASE</code>, <code>SALARY_NORMAL</code>,{' '}
                  <code>SALARY_INTEGRAL</code>, <code>BASE_IVSS</code>, <code>BASE_PARO</code>,{' '}
                  <code>BASE_FAOV</code>, <code>PERIOD_DAYS</code>, <code>MONTH_DAYS</code>,{' '}
                  <code>HOURS</code>, <code>UNITS</code>.
                </FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="affectsIntegralSalary"
                  name="affectsIntegralSalary"
                  defaultChecked={editing?.affectsIntegralSalary ?? false}
                />
                <FieldLabel htmlFor="affectsIntegralSalary">
                  Entra en el salario integral (alícuota)
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="isSalarial"
                  name="isSalarial"
                  defaultChecked={editing?.isSalarial ?? true}
                />
                <FieldLabel htmlFor="isSalarial">Es salarial</FieldLabel>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createConcept.isPending || updateConcept.isPending}>
                {createConcept.isPending || updateConcept.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
