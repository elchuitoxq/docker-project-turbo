'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus } from 'lucide-react';
import { toast } from 'sonner';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  treasuryMethodsApi,
  type PaymentMethodAdmin,
} from '@/modules/finance/api/treasury-operations';

/**
 * Administración de métodos de pago (`T-05-01`, `T-05-08`).
 *
 * Un método desactivado deja de ofrecerse al cobrar pero se conserva para los pagos históricos.
 */
export function PaymentMethodsView() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-methods', 'all'],
    queryFn: treasuryMethodsApi.listAll,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      treasuryMethodsApi.update(id, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el método'),
  });

  const methods = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Métodos de pago</h1>
          <p className="text-sm text-muted-foreground">
            Efectivo, transferencia, Pago Móvil, Zelle y divisas, con IGTF y referencia obligatoria
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          Nuevo método
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" /> {methods.length} métodos
          </CardTitle>
          <CardDescription>
            Desactivar un método lo oculta del cobro; no borra el historial
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>IGTF</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Efectivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map(method => (
                  <TableRow key={method.id}>
                    <TableCell className="font-medium">{method.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{method.code}</TableCell>
                    <TableCell>{method.appliesIgtf ? <Badge>IGTF</Badge> : '—'}</TableCell>
                    <TableCell>{method.requiresReference ? 'Sí' : '—'}</TableCell>
                    <TableCell>{method.isCash ? 'Sí' : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={method.isActive ? 'default' : 'secondary'}>
                        {method.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={Boolean(method.isActive)}
                        onCheckedChange={checked => {
                          if (!method.isActive) {
                            toast.info('Un método inactivo no aparece al cobrar');
                          }
                          toggle.mutate({ id: method.id, isActive: checked });
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateMethodDialog
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
          }}
        />
      )}
    </div>
  );
}

function CreateMethodDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [appliesIgtf, setAppliesIgtf] = React.useState(false);
  const [requiresReference, setRequiresReference] = React.useState(false);
  const [isCash, setIsCash] = React.useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      treasuryMethodsApi.create({
        name,
        code: code.toUpperCase().replace(/\s+/g, '_'),
        appliesIgtf,
        requiresReference,
        isCash,
      }),
    onSuccess: async () => {
      toast.success('Método creado');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el método'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo método de pago</DialogTitle>
          <DialogDescription>
            El código es único por sucursal y no se puede cambiar después
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="method-name">Nombre</FieldLabel>
            <Input
              id="method-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Pago Móvil Banesco"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="method-code">Código</FieldLabel>
            <Input
              id="method-code"
              value={code}
              onChange={event => setCode(event.target.value)}
              placeholder="PAGO_MOVIL"
            />
          </Field>
          <Field orientation="horizontal">
            <Switch id="method-igtf" checked={appliesIgtf} onCheckedChange={setAppliesIgtf} />
            <FieldLabel htmlFor="method-igtf">Aplica IGTF</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Switch
              id="method-ref"
              checked={requiresReference}
              onCheckedChange={setRequiresReference}
            />
            <FieldLabel htmlFor="method-ref">Exige referencia</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Switch id="method-cash" checked={isCash} onCheckedChange={setIsCash} />
            <FieldLabel htmlFor="method-cash">Es efectivo</FieldLabel>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || !code.trim() || mutation.isPending}
          >
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
