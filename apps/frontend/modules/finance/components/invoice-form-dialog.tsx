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
import { invoicesApi, type CreateInvoicePayload } from '../api/invoices';

type InvoiceType = 'SALE' | 'PURCHASE';

type Errors = {
  partnerId?: string;
  items?: string;
  rate?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La pantalla de facturación también emite compras; los listados de venta fijan el tipo. */
  defaultType?: InvoiceType;
};

/**
 * Alta de factura de venta o de compra (`T-09-10`).
 *
 * La factura nace en `DRAFT` con moneda y tasa congeladas y los totales calculados por el backend
 * (base, IVA e IGTF). La previsualización usa la misma fórmula (`computeDocumentTotals`) para que el
 * usuario vea el monto antes de guardar; el documento definitivo siempre es el que devuelve el API.
 *
 * El vencimiento se puede dejar vacío: el backend lo calcula con los días de crédito del tercero.
 */
export function InvoiceFormDialog({ open, onOpenChange, defaultType = 'SALE' }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currencies } = useCurrencies();
  const { baseCode } = useCurrencyIndex();
  const { data: rates } = useLatestRates({ enabled: open });
  const { data: warehouses } = useWarehouseOptions(open);

  const [type, setType] = React.useState<InvoiceType>(defaultType);
  const [partnerId, setPartnerId] = React.useState<string | null>(null);
  const [warehouseId, setWarehouseId] = React.useState<string>('');
  const [currencyId, setCurrencyId] = React.useState<string>('');
  // `null` significa "usa la tasa vigente del sistema"; el usuario puede sobrescribirla.
  const [rateInput, setRateInput] = React.useState<number | null>(null);
  const [dueDate, setDueDate] = React.useState<string>('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = React.useState<string>('');
  const [lines, setLines] = React.useState<LineDraft[]>([emptyLine()]);
  const [rateConfirmed, setRateConfirmed] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({});

  const baseCurrency = currencies?.find(currency => currency.isBase);
  // Sin moneda elegida la factura va en moneda funcional: se deriva en vez de copiarla a un estado.
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

  // El IGTF sólo aplica a ventas en divisa (regla del backend: cliente + moneda extranjera).
  const applyIgtf = type === 'SALE' && !isBaseCurrency;

  const resetForm = () => {
    setType(defaultType);
    setPartnerId(null);
    setWarehouseId('');
    setCurrencyId('');
    setRateInput(null);
    setDueDate('');
    setSupplierInvoiceNumber('');
    setLines([emptyLine()]);
    setRateConfirmed(false);
    setErrors({});
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const totals = computeDocumentTotals(
    lines.map(line => ({
      quantity: line.quantity,
      price: line.price,
      taxRate: line.taxRate,
      isExempt: line.isExempt,
    })),
    { applyIgtf }
  );
  const currencyCode = effectiveCurrency?.code ?? 'VES';

  const create = useMutation({
    mutationFn: (payload: CreateInvoicePayload) => invoicesApi.create(payload),
    onSuccess: async invoice => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(`Factura ${invoice.code} creada en borrador`);
      handleOpenChange(false);
      router.push(`/dashboard/finance/invoices/${invoice.id}`);
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la factura'),
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: Errors = {};
    if (!partnerId) nextErrors.partnerId = 'Elige el cliente o proveedor';
    const usableLines = lines.filter(line => line.productId && line.quantity > 0);
    if (usableLines.length === 0) nextErrors.items = 'Agrega al menos una línea con producto';
    if (!isBaseCurrency && (!rateValue || rateValue <= 0))
      nextErrors.rate = 'Indica la tasa de cambio de la factura';
    if (blockedByRate) nextErrors.rate = 'Confirma la tasa vencida antes de continuar';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !partnerId) return;

    const items = usableLines.map(line => ({
      productId: line.productId as string,
      quantity: line.quantity,
      price: line.price,
      ...(line.taxRate ? { taxRate: line.taxRate } : {}),
    }));

    await create.mutateAsync({
      partnerId,
      ...(warehouseId ? { warehouseId } : {}),
      ...(effectiveCurrency?.id ? { currencyId: effectiveCurrency.id } : {}),
      type,
      ...(isBaseCurrency ? {} : { exchangeRate: rateValue }),
      ...(dueDate ? { dueDate: new Date(`${dueDate}T23:59:59`).toISOString() } : {}),
      ...(type === 'PURCHASE' && supplierInvoiceNumber.trim()
        ? { supplierInvoiceNumber: supplierInvoiceNumber.trim() }
        : {}),
      items,
    });
  };

  const saving = create.isPending;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Nueva factura</SheetTitle>
          <SheetDescription>
            Se registra como borrador con la moneda y la tasa del día. Se emite (postea) desde la
            ficha, que es cuando se asigna el folio fiscal.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="invoice-type">Tipo</FieldLabel>
              <Select
                value={type}
                onValueChange={value => {
                  setType(value as InvoiceType);
                  setPartnerId(null);
                }}
                disabled={saving}
              >
                <SelectTrigger id="invoice-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALE">Venta (cliente)</SelectItem>
                  <SelectItem value="PURCHASE">Compra (proveedor)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field data-invalid={!!errors.partnerId}>
              <FieldLabel htmlFor="invoice-partner">
                {type === 'SALE' ? 'Cliente' : 'Proveedor'} *
              </FieldLabel>
              <PartnerCombobox
                id="invoice-partner"
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
              <FieldLabel htmlFor="invoice-warehouse">Almacén</FieldLabel>
              <Select
                value={warehouseId || 'NONE'}
                onValueChange={value => setWarehouseId(value === 'NONE' ? '' : value)}
                disabled={saving}
              >
                <SelectTrigger id="invoice-warehouse">
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
              <FieldLabel htmlFor="invoice-due-date">Vencimiento</FieldLabel>
              <DatePicker
                id="invoice-due-date"
                value={dueDate}
                onChange={setDueDate}
                placeholder="Sin vencimiento"
                disabled={saving}
                clearable
              />
              <FieldDescription>
                Si se deja vacío, se calcula con los días de crédito del tercero.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="invoice-currency">Moneda</FieldLabel>
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
                <SelectTrigger id="invoice-currency">
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
              <FieldLabel htmlFor="invoice-rate">Tasa de cambio</FieldLabel>
              <Input
                id="invoice-rate"
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

            {type === 'PURCHASE' && (
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="invoice-supplier-number">
                  Número de factura del proveedor
                </FieldLabel>
                <Input
                  id="invoice-supplier-number"
                  value={supplierInvoiceNumber}
                  onChange={event => setSupplierInvoiceNumber(event.target.value)}
                  placeholder="00001234"
                  disabled={saving}
                />
              </Field>
            )}
          </FieldGroup>

          {staleRate && (
            <StaleRateGate
              rate={systemRate}
              currencyCode={currencyCode}
              confirmed={rateConfirmed}
              onConfirmedChange={setRateConfirmed}
              documentLabel="una factura"
            />
          )}
          {errors.rate && !staleRate && <p className="text-xs text-destructive">{errors.rate}</p>}

          <LineItemsEditor
            lines={lines}
            onChange={setLines}
            currencyCode={currencyCode}
            rateOf={rateOf}
            withTax
            disabled={saving}
            error={errors.items}
          />

          <div className="flex flex-col gap-1 rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Base imponible</span>
              <span className="tabular-nums">{formatMoney(totals.totalBase, currencyCode)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span className="tabular-nums">{formatMoney(totals.totalTax, currencyCode)}</span>
            </div>
            {applyIgtf && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">IGTF (3 %)</span>
                <span className="tabular-nums">{formatMoney(totals.totalIgtf, currencyCode)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totals.total, currencyCode)}</span>
            </div>
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
              Crear factura
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
