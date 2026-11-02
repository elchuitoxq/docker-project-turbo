'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { StaleRateGate } from '@/components/finance/stale-rate-gate';
import { useCurrencies, useCurrencyIndex } from '@/lib/currency';
import { documentRateLookup, findRate, isRateStale, useLatestRates } from '@/lib/rates';
import { formatMoney } from '@/lib/utils';
import { PartnerCombobox } from '@/modules/partners/components/partner-combobox';
import { useWarehouseOptions } from '@/modules/inventory/hooks/use-warehouses';
import {
  LineItemsEditor,
  convertLines,
  emptyLine,
  type LineDraft,
} from '@/modules/documents/components/line-items-editor';
import { computeDocumentTotals } from '@/modules/documents/totals';
import { ordersApi, type OrderPayload } from '../orders-api';

type OrderType = 'SALE' | 'PURCHASE';

type Errors = {
  partnerId?: string;
  items?: string;
  rate?: string;
};

/**
 * Código del pedido (`T-09-15`).
 *
 * `orders.code` es único y el backend no lo genera: se arma con la fecha y un sufijo aleatorio. Si dos
 * usuarios coincidieran, el API responde 400 y el usuario reintenta (no hay riesgo de duplicado).
 */
export function nextOrderCode(today: Date = new Date()): string {
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `ORD-${stamp}-${suffix}`;
}

function todayInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Alta de pedido de venta o de compra (`T-09-15`).
 *
 * El pedido nace en `DRAFT` con la moneda y la tasa **congeladas**: los cambios posteriores de tasa no
 * lo afectan. La UI no decide reglas de negocio (el backend valida sucursal, tercero y estado); sólo
 * evita enviar un pedido sin tercero, sin líneas o con una tasa vencida sin confirmar.
 */
export function OrderFormDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currencies } = useCurrencies();
  const { baseCode } = useCurrencyIndex();
  const { data: rates } = useLatestRates({ enabled: open });
  const { data: warehouses } = useWarehouseOptions(open);

  const [type, setType] = React.useState<OrderType>('SALE');
  const [partnerId, setPartnerId] = React.useState<string | null>(null);
  const [warehouseId, setWarehouseId] = React.useState<string>('');
  const [currencyId, setCurrencyId] = React.useState<string>('');
  // `null` significa "usa la tasa vigente del sistema"; el usuario puede sobrescribirla.
  const [rateInput, setRateInput] = React.useState<number | null>(null);
  const [date, setDate] = React.useState<string>(todayInput());
  const [lines, setLines] = React.useState<LineDraft[]>([emptyLine()]);
  const [rateConfirmed, setRateConfirmed] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({});

  const baseCurrency = currencies?.find(currency => currency.isBase);
  // Sin moneda elegida el pedido va en moneda funcional: se deriva, no se copia a un estado aparte.
  const effectiveCurrency =
    currencies?.find(currency => currency.id === currencyId) ?? baseCurrency;
  const isBaseCurrency = effectiveCurrency?.isBase ?? true;
  const systemRate = findRate(rates, effectiveCurrency?.code);
  const rateValue = isBaseCurrency ? 1 : (rateInput ?? systemRate?.rate ?? 0);
  const staleRate = !isBaseCurrency && Boolean(systemRate) && isRateStale(systemRate?.date);
  const blockedByRate = staleRate && !rateConfirmed;

  const rateOf = React.useMemo(
    () =>
      documentRateLookup({
        documentCode: effectiveCurrency?.code ?? baseCode,
        documentRate: rateValue,
        baseCode,
        rates,
      }),
    [effectiveCurrency?.code, baseCode, rateValue, rates]
  );

  const resetForm = () => {
    setType('SALE');
    setPartnerId(null);
    setWarehouseId('');
    setCurrencyId('');
    setRateInput(null);
    setDate(todayInput());
    setLines([emptyLine()]);
    setRateConfirmed(false);
    setErrors({});
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const totals = computeDocumentTotals(
    lines.map(line => ({ quantity: line.quantity, price: line.price }))
  );
  const currencyCode = effectiveCurrency?.code ?? 'VES';

  const create = useMutation({
    mutationFn: (payload: OrderPayload) => ordersApi.create(payload),
    onSuccess: async order => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Pedido ${order.code} creado en borrador`);
      handleOpenChange(false);
      router.push(`/dashboard/operations/orders/${order.id}`);
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el pedido'),
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: Errors = {};
    if (!partnerId) nextErrors.partnerId = 'Elige el cliente o proveedor';
    const usableLines = lines.filter(line => line.productId && line.quantity > 0);
    if (usableLines.length === 0) nextErrors.items = 'Agrega al menos una línea con producto';
    if (!isBaseCurrency && (!rateValue || rateValue <= 0))
      nextErrors.rate = 'Indica la tasa de cambio del pedido';
    if (blockedByRate) nextErrors.rate = 'Confirma la tasa vencida antes de continuar';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !partnerId) return;

    const items = usableLines.map(line => ({
      productId: line.productId as string,
      quantity: line.quantity,
      price: line.price,
    }));

    await create.mutateAsync({
      code: nextOrderCode(),
      partnerId,
      ...(warehouseId ? { warehouseId } : {}),
      type,
      ...(effectiveCurrency?.id ? { currencyId: effectiveCurrency.id } : {}),
      ...(isBaseCurrency ? {} : { exchangeRate: rateValue }),
      date,
      items,
    });
  };

  const saving = create.isPending;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Nuevo pedido</SheetTitle>
          <SheetDescription>
            El pedido queda en borrador con la moneda y la tasa del día; después se confirma y se
            factura desde su ficha.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="order-type">Tipo</FieldLabel>
              <Select
                value={type}
                onValueChange={value => {
                  setType(value as OrderType);
                  setPartnerId(null);
                }}
                disabled={saving}
              >
                <SelectTrigger id="order-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALE">Venta (cliente)</SelectItem>
                  <SelectItem value="PURCHASE">Compra (proveedor)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field data-invalid={!!errors.partnerId}>
              <FieldLabel htmlFor="order-partner">
                {type === 'SALE' ? 'Cliente' : 'Proveedor'} *
              </FieldLabel>
              <PartnerCombobox
                id="order-partner"
                value={partnerId}
                onChange={setPartnerId}
                filterType={type === 'SALE' ? 'CUSTOMER' : 'VENDOR'}
                placeholder={type === 'SALE' ? 'Elegir cliente…' : 'Elegir proveedor…'}
                disabled={saving}
                className={errors.partnerId ? 'border-destructive' : undefined}
              />
              {errors.partnerId && (
                <FieldDescription className="text-destructive">{errors.partnerId}</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="order-warehouse">Almacén</FieldLabel>
              <Select
                value={warehouseId || 'NONE'}
                onValueChange={value => setWarehouseId(value === 'NONE' ? '' : value)}
                disabled={saving}
              >
                <SelectTrigger id="order-warehouse">
                  <SelectValue placeholder="Sin almacén" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin almacén</SelectItem>
                  {(warehouses ?? []).map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="order-date">Fecha</FieldLabel>
              <DatePicker id="order-date" value={date} onChange={setDate} disabled={saving} />
            </Field>

            <Field>
              <FieldLabel htmlFor="order-currency">Moneda</FieldLabel>
              <Select
                value={effectiveCurrency?.id ?? ''}
                onValueChange={value => {
                  setCurrencyId(value);
                  // Al cambiar de moneda la tasa vuelve a la vigente del sistema.
                  setRateInput(null);
                  setRateConfirmed(false);

                  const code =
                    currencies?.find(currency => currency.id === value)?.code ?? currencyCode;
                  const nextRate = code === baseCode ? 1 : (findRate(rates, code)?.rate ?? 0);
                  setLines(current =>
                    convertLines(
                      current,
                      code,
                      documentRateLookup({
                        documentCode: code,
                        documentRate: nextRate,
                        baseCode,
                        rates,
                      })
                    )
                  );
                }}
                disabled={saving}
              >
                <SelectTrigger id="order-currency">
                  <SelectValue placeholder="Moneda funcional" />
                </SelectTrigger>
                <SelectContent>
                  {(currencies ?? []).map(currency => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.code} · {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field data-invalid={!!errors.rate}>
              <FieldLabel htmlFor="order-rate">Tasa de cambio</FieldLabel>
              <Input
                id="order-rate"
                type="number"
                step="0.0001"
                min={0}
                value={rateValue}
                onChange={event => {
                  const next = Number(event.target.value);
                  setRateInput(next);
                  // La tasa nueva se aplica en el acto a los precios automáticos de las líneas.
                  setLines(current =>
                    convertLines(
                      current,
                      currencyCode,
                      documentRateLookup({
                        documentCode: currencyCode,
                        documentRate: next,
                        baseCode,
                        rates,
                      })
                    )
                  );
                }}
                disabled={saving || isBaseCurrency}
              />
              <FieldDescription>
                {isBaseCurrency
                  ? 'La moneda funcional siempre se registra con tasa 1.'
                  : `1 ${currencyCode} = ${rateValue} ${baseCurrency?.code ?? 'VES'}`}
              </FieldDescription>
            </Field>
          </FieldGroup>
          {staleRate && (
            <StaleRateGate
              rate={systemRate}
              currencyCode={currencyCode}
              confirmed={rateConfirmed}
              onConfirmedChange={setRateConfirmed}
              documentLabel="un pedido"
            />
          )}
          {errors.rate && !staleRate && <p className="text-xs text-destructive">{errors.rate}</p>}

          <LineItemsEditor
            lines={lines}
            onChange={setLines}
            currencyCode={currencyCode}
            rateOf={rateOf}
            disabled={saving}
            error={errors.items}
          />

          <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Total del pedido</span>
            <span className="font-semibold tabular-nums">
              {formatMoney(totals.total, currencyCode)}
            </span>
          </div>

          <SheetFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || blockedByRate}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Crear pedido
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
