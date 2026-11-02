'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Percent, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { payablesApi, type SupplierRetentionSettings } from '@/modules/finance/api/payables';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { taxConceptsApi } from '../../tax-concepts/api';

/**
 * Parámetros de retención al proveedor por empresa (`T-03-03`, `S-21`).
 *
 * Son los valores por defecto: el IVA se retiene siempre con estos porcentajes, mientras que el ISLR
 * sólo los usa cuando el proveedor **no** tiene concepto ni tasa propia. La precedencia se explica en
 * la propia pantalla para que nadie cambie el ISLR esperando que aplique a todos.
 */
export function RetentionSettingsView() {
  const settings = useQuery({
    queryKey: ['supplier-retention-settings'],
    queryFn: payablesApi.getRetentionSettings,
  });

  const concepts = useQuery({
    queryKey: ['settings', 'tax-concepts'],
    queryFn: taxConceptsApi.list,
  });

  const enabledConcepts = (concepts.data ?? []).filter(concept => concept.isEnabled).length;

  if (settings.isLoading || !settings.data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Retenciones al proveedor</h1>
        <p className="text-sm text-muted-foreground">
          IVA siempre con estos porcentajes; ISLR como valor por defecto del proveedor
        </p>
      </div>

      {/* El formulario nace con los parámetros ya cargados: sin efectos que copien estado. */}
      <RetentionForm
        key={settings.data.companyId}
        initial={settings.data}
        enabledConcepts={enabledConcepts}
      />
    </div>
  );
}

function RetentionForm({
  initial,
  enabledConcepts,
}: {
  initial: SupplierRetentionSettings;
  enabledConcepts: number;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canEdit = hasPermission(PERMISSIONS.FINANCE.INVOICES.EDIT);
  const [form, setForm] = React.useState<SupplierRetentionSettings>(initial);

  const save = useMutation({
    mutationFn: (payload: Partial<Omit<SupplierRetentionSettings, 'companyId'>>) =>
      payablesApi.updateRetentionSettings(payload),
    onSuccess: async updated => {
      setForm(updated);
      await queryClient.invalidateQueries({ queryKey: ['supplier-retention-settings'] });
      toast.success('Parámetros de retención actualizados');
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los parámetros'),
  });

  const set =
    (key: keyof SupplierRetentionSettings) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm(current => ({ ...current, [key]: Number(event.target.value) }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="size-4" /> Parámetros vigentes
          </CardTitle>
          <CardDescription>
            Los porcentajes cambian por decreto: aquí se ajustan sin tocar código
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="iva-rate">IVA ordinario (%)</FieldLabel>
              <Input
                id="iva-rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.ivaRetentionRate}
                onChange={set('ivaRetentionRate')}
                disabled={!canEdit}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="iva-rate-special">IVA contribuyente especial (%)</FieldLabel>
              <Input
                id="iva-rate-special"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.ivaRetentionRateSpecial}
                onChange={set('ivaRetentionRateSpecial')}
                disabled={!canEdit}
              />
            </Field>

            <Separator />

            <Field>
              <FieldLabel htmlFor="islr-rate">ISLR por defecto (%)</FieldLabel>
              <Input
                id="islr-rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.islrRate}
                onChange={set('islrRate')}
                disabled={!canEdit}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="islr-sustraendo">Sustraendo (Bs)</FieldLabel>
              <Input
                id="islr-sustraendo"
                type="number"
                min={0}
                step="0.01"
                value={form.islrSustraendo}
                onChange={set('islrSustraendo')}
                disabled={!canEdit}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="islr-threshold">Base mínima para retener (Bs)</FieldLabel>
              <Input
                id="islr-threshold"
                type="number"
                min={0}
                step="0.01"
                value={form.islrThreshold}
                onChange={set('islrThreshold')}
                disabled={!canEdit}
              />
            </Field>
          </FieldGroup>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => save.mutate(form)} disabled={!canEdit || save.isPending}>
              <Save data-icon="inline-start" />
              Guardar parámetros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cómo se decide la retención de ISLR</CardTitle>
          <CardDescription>
            El porcentaje del comprobante sigue este orden; el primero que exista gana
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">1. Concepto del proveedor.</span> Si su
            ficha tiene un concepto habilitado, se usa su porcentaje, base mínima y sustraendo. Hoy
            hay {enabledConcepts} conceptos habilitados en{' '}
            <a className="underline" href="/dashboard/settings/tax-concepts">
              Impuestos
            </a>
            .
          </p>
          <p>
            <span className="font-medium text-foreground">2. Tasa propia del proveedor.</span> Si no
            tiene concepto pero su ficha trae un porcentaje de retención mayor que cero, se usa ese.
          </p>
          <p>
            <span className="font-medium text-foreground">3. Estos parámetros.</span> Si no tiene ni
            concepto ni tasa propia, se aplica el ISLR por defecto de esta pantalla.
          </p>
          <p className="text-xs">
            El comprobante guarda el porcentaje aplicado y de dónde salió, así que se puede auditar
            sin recalcular.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
