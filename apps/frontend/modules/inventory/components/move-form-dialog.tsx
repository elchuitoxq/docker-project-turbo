'use client';

import * as React from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, Plus, Sliders, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ProductCombobox } from './product-combobox';
import { useCreateMove } from '../hooks/use-moves';
import { useProductBatches } from '../hooks/use-batches';
import { useWarehouseOptions } from '../hooks/use-warehouses';
import { ADJUSTMENT_REASONS, type MoveType } from '../api/moves';

const TYPE_LABEL: Record<MoveType, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  TRANSFER: 'Transferencia',
  ADJUSTMENT: 'Ajuste',
};

const TYPE_HINT: Record<MoveType, string> = {
  IN: 'Mercancía que entra al almacén (compra, devolución de cliente, producción).',
  OUT: 'Mercancía que sale del almacén (consumo, devolución a proveedor, merma).',
  TRANSFER: 'Mueve la misma cantidad de un almacén a otro.',
  ADJUSTMENT: 'Corrige el stock al resultado del conteo físico: la cantidad es la contada.',
};

const TYPE_ICON: Record<MoveType, React.ComponentType<{ className?: string }>> = {
  IN: ArrowDown,
  OUT: ArrowUp,
  TRANSFER: ArrowLeftRight,
  ADJUSTMENT: Sliders,
};

type LineDraft = {
  key: string;
  productId: string;
  productLabel: string;
  quantity: string;
  cost: string;
  /** El producto maneja lotes: hay que decir de cuál sale o con cuál entra. */
  hasBatches: boolean;
  /** Lote elegido en una salida o ajuste (FEFO). */
  batchId: string;
  /** Lote que se crea en la recepción. */
  batchNumber: string;
  batchExpirationDate: string;
  /** Lote que el FEFO sugiere y que el usuario no eligió (excepción a autorizar). */
  fefoSuggestedId: string;
  fefoReason: string;
};

const newLine = (): LineDraft => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  productId: '',
  productLabel: '',
  quantity: '1',
  cost: '',
  hasBatches: false,
  batchId: '',
  batchNumber: '',
  batchExpirationDate: '',
  fefoSuggestedId: '',
  fefoReason: '',
});

/**
 * Selector de lote para salidas y ajustes.
 *
 * El backend devuelve los lotes ordenados por FEFO (vence primero), así que el primero con existencia
 * es el que hay que consumir. Se preselecciona sólo una vez, cuando la línea todavía no tiene lote, y
 * se muestra la existencia del almacén para que la cantidad a sacar sea verificable.
 *
 * `S-26`: los lotes vencidos y los bloqueados se ven pero no se pueden elegir —el backend los rechaza—
 * y si el usuario se salta el sugerido se le pide el motivo en el momento.
 */
function FifoBatchSelect({
  productId,
  warehouseId,
  value,
  reason,
  onChange,
  onSuggested,
  onReasonChange,
}: {
  productId: string;
  warehouseId?: string;
  value: string;
  reason: string;
  onChange: (batchId: string) => void;
  onSuggested: (batchId: string) => void;
  onReasonChange: (reason: string) => void;
}) {
  const batches = useProductBatches(productId, warehouseId);
  const rows = batches.data ?? [];
  const usable = (row: (typeof rows)[number]) =>
    row.isActive !== false && !row.expired && Number(row.availableQuantity ?? 0) > 0;
  const suggested = rows.find(usable) ?? rows.find(row => row.isActive !== false && !row.expired);
  const suggestedId = suggested?.id ?? '';
  const autoSelected = React.useRef(false);
  const reportedSuggested = React.useRef('');

  React.useEffect(() => {
    // Se reporta y se preselecciona una sola vez por lote sugerido: `onSuggested` cambia de identidad
    // en cada render del formulario y sin esta guarda el efecto se realimentaría.
    if (!suggestedId || reportedSuggested.current === suggestedId) return;
    reportedSuggested.current = suggestedId;
    onSuggested(suggestedId);

    if (autoSelected.current || value) return;
    autoSelected.current = true;
    onChange(suggestedId);
  }, [onChange, onSuggested, suggestedId, value]);

  const offFefo = Boolean(value && suggestedId && value !== suggestedId);

  return (
    <div className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor={`batch-${productId}`} className="text-xs">
          Lote (FEFO)
        </FieldLabel>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={`batch-${productId}`}>
            <SelectValue placeholder={rows.length === 0 ? 'Sin lotes' : 'Selecciona'} />
          </SelectTrigger>
          <SelectContent>
            {rows.map((row, index) => (
              <SelectItem key={row.id} value={row.id} disabled={!usable(row)}>
                {row.batchNumber}
                {row.expirationDate ? ` · vence ${row.expirationDate.slice(0, 10)}` : ''} ·{' '}
                {Number(row.availableQuantity ?? 0).toLocaleString('es-VE')}
                {Number(row.reservedQuantity ?? 0) > 0
                  ? ` · ${Number(row.reservedQuantity).toLocaleString('es-VE')} reservado`
                  : ''}
                {row.expired ? ' · vencido' : ''}
                {row.isActive === false ? ' · bloqueado' : ''}
                {index === rows.indexOf(suggested as (typeof rows)[number]) && usable(row)
                  ? ' (sugerido)'
                  : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rows.length === 0 && (
          <p className="text-xs text-destructive">
            El producto maneja lotes pero no tiene ninguno: regístralo en una entrada.
          </p>
        )}
      </Field>

      {offFefo && (
        <Field data-invalid>
          <FieldLabel htmlFor={`fefo-${productId}`} className="text-xs">
            Motivo para no despachar{' '}
            {rows.find(row => row.id === suggestedId)?.batchNumber ?? 'el lote sugerido'}
          </FieldLabel>
          <Input
            id={`fefo-${productId}`}
            aria-invalid
            value={reason}
            onChange={event => onReasonChange(event.target.value)}
            placeholder="El cliente exige este lote, lote reservado…"
          />
          <p className="text-xs text-destructive">
            Despachar otro lote deja mercancía más vieja en el almacén: queda registrado como
            excepción.
          </p>
        </Field>
      )}
    </div>
  );
}

/**
 * Alta de movimientos de inventario (`S-23`).
 *
 * El listado sólo permitía aprobar y rechazar: no había forma de crear una entrada, una salida, una
 * transferencia ni un ajuste desde la aplicación. El movimiento nace en borrador (`EN_TRAMITE`) y el
 * stock sólo se mueve al aprobarlo, así que la captura y la autorización quedan separadas.
 */
export function MoveFormDialog({
  onClose,
  onDone,
  defaultType = 'IN',
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
  defaultType?: MoveType;
}) {
  const [type, setType] = React.useState<MoveType>(defaultType);
  const [fromWarehouseId, setFromWarehouseId] = React.useState('');
  const [toWarehouseId, setToWarehouseId] = React.useState('');
  const [reasonCode, setReasonCode] = React.useState('');
  const [note, setNote] = React.useState('');
  const [lines, setLines] = React.useState<LineDraft[]>([newLine()]);

  const warehouses = useWarehouseOptions();
  const create = useCreateMove();
  const isAdjustment = type === 'ADJUSTMENT';
  const Icon = TYPE_ICON[type];

  const warehousesList = warehouses.data ?? [];

  // Al cambiar de tipo se limpia el almacén que ya no aplica, para no enviar un id contradictorio.
  const changeType = (next: MoveType) => {
    setType(next);
    if (next === 'IN') setFromWarehouseId('');
    if (next === 'OUT' || next === 'ADJUSTMENT') setToWarehouseId('');
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines(current => current.map(line => (line.key === key ? { ...line, ...patch } : line)));

  const removeLine = (key: string) =>
    setLines(current => (current.length === 1 ? current : current.filter(l => l.key !== key)));

  const validLines = lines.filter(line => line.productId && Number(line.quantity) >= 0);
  const warehouseOk =
    type === 'IN'
      ? Boolean(toWarehouseId)
      : type === 'TRANSFER'
        ? Boolean(fromWarehouseId && toWarehouseId && fromWarehouseId !== toWarehouseId)
        : Boolean(fromWarehouseId);

  // Un ajuste sin motivo no se puede registrar: el backend lo rechaza y aquí se avisa antes.
  const reasonOk = !isAdjustment || Boolean(reasonCode);

  // En una salida, un producto con lotes tiene que decir de qué lote sale; si no, el stock del lote
  // queda intacto y el movimiento falla por existencia insuficiente.
  const batchesOk = validLines.every(
    line => !line.hasBatches || type !== 'OUT' || Boolean(line.batchId)
  );

  // `S-26`: despachar un lote posterior al sugerido exige motivo.
  const offFefoLines = validLines.filter(
    line =>
      line.hasBatches &&
      type === 'OUT' &&
      Boolean(line.batchId) &&
      Boolean(line.fefoSuggestedId) &&
      line.batchId !== line.fefoSuggestedId
  );
  const fefoOk = offFefoLines.every(line => line.fefoReason.trim().length > 0);

  const duplicateProducts = new Set(
    validLines.map(line => line.productId).filter((id, index, all) => all.indexOf(id) !== index)
  );

  const canSubmit =
    warehouseOk &&
    reasonOk &&
    batchesOk &&
    fefoOk &&
    validLines.length === lines.length &&
    validLines.length > 0 &&
    duplicateProducts.size === 0 &&
    !create.isPending;

  const submit = () => {
    create.mutate(
      {
        type,
        ...(type === 'IN' ? { toWarehouseId } : {}),
        ...(type !== 'IN' ? { fromWarehouseId } : {}),
        ...(type === 'TRANSFER' ? { toWarehouseId } : {}),
        ...(isAdjustment ? { reasonCode } : {}),
        ...(offFefoLines.length > 0
          ? { fefoOverride: true, fefoOverrideReason: offFefoLines[0].fefoReason.trim() }
          : {}),
        note,
        lines: validLines.map(line => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          ...(line.cost.trim() ? { cost: Number(line.cost) } : {}),
          ...(line.hasBatches && line.batchId ? { batchId: line.batchId } : {}),
          // En la recepción el lote se crea si no existe: se envía el número, no el id.
          ...(line.hasBatches && !line.batchId && line.batchNumber.trim()
            ? { batchNumber: line.batchNumber.trim() }
            : {}),
          ...(line.hasBatches && !line.batchId && line.batchExpirationDate
            ? { batchExpirationDate: line.batchExpirationDate }
            : {}),
        })),
      },
      {
        onSuccess: async () => {
          toast.success('Movimiento creado en borrador: apruébalo para mover el stock');
          await onDone();
        },
        onError: error =>
          toast.error(error instanceof Error ? error.message : 'No se pudo crear el movimiento'),
      }
    );
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      {/* Un movimiento puede llevar varias líneas: sin altura máxima ni scroll el pie con el botón de
          crear queda fuera del viewport y el formulario no se puede enviar. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo movimiento de inventario</DialogTitle>
          <DialogDescription>
            Queda en borrador hasta que se apruebe; ahí recién se mueve el stock
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="move-type">Tipo</FieldLabel>
            <Select value={type} onValueChange={v => changeType(v as MoveType)}>
              <SelectTrigger id="move-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as MoveType[]).map(key => (
                  <SelectItem key={key} value={key}>
                    {TYPE_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Icon className="mt-0.5 size-3.5 shrink-0" />
              {TYPE_HINT[type]}
            </p>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            {type !== 'IN' && (
              <Field>
                <FieldLabel htmlFor="move-from">
                  {isAdjustment ? 'Almacén a ajustar' : 'Almacén de origen'}
                </FieldLabel>
                <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
                  <SelectTrigger id="move-from">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehousesList.map(warehouse => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {(type === 'IN' || type === 'TRANSFER') && (
              <Field>
                <FieldLabel htmlFor="move-to">Almacén de destino</FieldLabel>
                <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                  <SelectTrigger id="move-to">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehousesList
                      .filter(warehouse => type !== 'TRANSFER' || warehouse.id !== fromWarehouseId)
                      .map(warehouse => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          {isAdjustment && (
            <Field>
              <FieldLabel htmlFor="move-reason">Motivo del ajuste</FieldLabel>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger id="move-reason">
                  <SelectValue placeholder="Selecciona el motivo" />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_REASONS.map(reason => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sin motivo no se puede registrar. Si la diferencia supera la tolerancia, la
                aprobación tiene que hacerla otra persona.
              </p>
            </Field>
          )}

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <FieldLabel>Productos</FieldLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines(current => [...current, newLine()])}
              >
                <Plus data-icon="inline-start" />
                Agregar línea
              </Button>
            </div>

            {lines.map((line, index) => (
              <div key={line.key} className="flex flex-col gap-2 rounded-md border p-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto]">
                  <div className="flex flex-col gap-1">
                    <ProductCombobox
                      value={line.productId || null}
                      onChange={product =>
                        updateLine(line.key, {
                          productId: product.id,
                          productLabel: `${product.name} · ${product.sku}`,
                          hasBatches: Boolean(product.hasBatches),
                          batchId: '',
                          batchNumber: '',
                          batchExpirationDate: '',
                          fefoSuggestedId: '',
                          fefoReason: '',
                        })
                      }
                      placeholder={`Producto ${index + 1}`}
                    />
                    {line.productLabel && (
                      <span className="truncate text-xs text-muted-foreground">
                        {line.productLabel}
                      </span>
                    )}
                  </div>
                  <Field>
                    <FieldLabel htmlFor={`qty-${line.key}`} className="text-xs">
                      {isAdjustment ? 'Contado' : 'Cantidad'}
                    </FieldLabel>
                    <Input
                      id={`qty-${line.key}`}
                      type="number"
                      min={0}
                      step="0.0001"
                      value={line.quantity}
                      onChange={event => updateLine(line.key, { quantity: event.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`cost-${line.key}`} className="text-xs">
                      Costo unit.
                    </FieldLabel>
                    <Input
                      id={`cost-${line.key}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.cost}
                      onChange={event => updateLine(line.key, { cost: event.target.value })}
                      placeholder="Opcional"
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar línea"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(line.key)}
                    className="self-end"
                  >
                    <Trash2 />
                  </Button>
                </div>

                {line.hasBatches && line.productId && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {type === 'OUT' || isAdjustment ? (
                      <FifoBatchSelect
                        productId={line.productId}
                        warehouseId={fromWarehouseId}
                        value={line.batchId}
                        reason={line.fefoReason}
                        onChange={batchId => updateLine(line.key, { batchId })}
                        onSuggested={fefoSuggestedId => updateLine(line.key, { fefoSuggestedId })}
                        onReasonChange={fefoReason => updateLine(line.key, { fefoReason })}
                      />
                    ) : (
                      <>
                        <Field>
                          <FieldLabel htmlFor={`batch-${line.key}`} className="text-xs">
                            Lote
                          </FieldLabel>
                          <Input
                            id={`batch-${line.key}`}
                            value={line.batchNumber}
                            onChange={event =>
                              updateLine(line.key, { batchNumber: event.target.value })
                            }
                            placeholder="Si no existe, se crea"
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`exp-${line.key}`} className="text-xs">
                            Vence
                          </FieldLabel>
                          <Input
                            id={`exp-${line.key}`}
                            type="date"
                            value={line.batchExpirationDate}
                            onChange={event =>
                              updateLine(line.key, { batchExpirationDate: event.target.value })
                            }
                          />
                        </Field>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {duplicateProducts.size > 0 && (
              <p className="text-xs text-destructive">
                Hay un producto repetido: cada producto debe aparecer una sola vez.
              </p>
            )}
            {type === 'TRANSFER' && fromWarehouseId && fromWarehouseId === toWarehouseId && (
              <p className="text-xs text-destructive">
                El almacén de origen y el de destino no pueden ser el mismo.
              </p>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="move-note">Nota</FieldLabel>
            <Input
              id="move-note"
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Motivo del movimiento"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            Crear movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
