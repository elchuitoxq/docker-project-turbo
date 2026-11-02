'use client';

import * as React from 'react';
import { useQueries } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useCurrencyIndex } from '@/lib/currency';
import { convertAmount, documentRateLookup, useLatestRates } from '@/lib/rates';
import { productsApi } from '@/modules/inventory/api/products';
import type { Product } from '@/modules/inventory/types';

export type ExchangeRateItem = {
  productId: string;
  quantity: number;
  price: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Texto para el aviso de error: "la factura A-00001", "el pedido ORD-…". */
  documentLabel: string;
  currencyCode: string;
  currentRate: number;
  items: ExchangeRateItem[];
  /** Persiste la tasa y, si se pidió, las líneas reconvertidas. */
  onSubmit: (payload: { exchangeRate: number; items?: ExchangeRateItem[] }) => Promise<void>;
};

/**
 * Corrección de la tasa de un documento que todavía no es fiscal.
 *
 * La tasa del documento manda sobre la vigente: aquí se escribe la que se va a aplicar. Si el
 * documento tiene líneas de productos en otra moneda, se pueden recalcular con la tasa nueva; las
 * líneas que ya estaban en la moneda del documento nunca se tocan.
 */
export function ExchangeRateDialog({
  open,
  onOpenChange,
  documentLabel,
  currencyCode,
  currentRate,
  items,
  onSubmit,
}: Props) {
  const { baseCode, codeOf } = useCurrencyIndex();
  const { data: rates } = useLatestRates({ enabled: open });

  const [rate, setRate] = React.useState(currentRate);
  const [recalculate, setRecalculate] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const productQueries = useQueries({
    queries: items.map(item => ({
      queryKey: ['products', 'detail', item.productId],
      queryFn: () => productsApi.get(item.productId),
      enabled: open,
      staleTime: 5 * 60_000,
    })),
  });

  const productById = new Map<string, Product>();
  for (const query of productQueries) {
    if (query.data) productById.set(query.data.id, query.data);
  }

  // Sólo tiene sentido recalcular cuando algún producto está en otra moneda que el documento.
  const hasForeignProducts = items.some(item => {
    const product = productById.get(item.productId);
    if (!product?.currencyId) return false;
    return codeOf(product.currencyId) !== currencyCode;
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!(rate > 0)) {
      toast.error('Indica una tasa mayor que cero');
      return;
    }

    const lookup = documentRateLookup({
      documentCode: currencyCode,
      documentRate: rate,
      baseCode,
      rates,
    });

    const converted = recalculate
      ? items.map(item => {
          const product = productById.get(item.productId);
          if (!product?.currencyId) return item;

          const price = convertAmount(
            Number(product.price ?? 0),
            codeOf(product.currencyId),
            currencyCode,
            lookup
          );

          return price === null ? item : { ...item, price };
        })
      : undefined;

    setSaving(true);
    try {
      await onSubmit({
        exchangeRate: rate,
        ...(converted ? { items: converted } : {}),
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `No se pudo actualizar ${documentLabel}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar tasa</DialogTitle>
          <DialogDescription>
            Corrige la tasa del documento: {documentLabel}. Al emitir, la tasa queda congelada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="exchange-rate">Tasa de cambio</FieldLabel>
              <Input
                id="exchange-rate"
                type="number"
                step="0.0001"
                min={0}
                value={rate}
                onChange={event => setRate(Number(event.target.value))}
                disabled={saving}
                autoFocus
              />
              <FieldDescription>
                1 {currencyCode} = {rate} {baseCode}
              </FieldDescription>
            </Field>

            <Field orientation="horizontal" className="items-center gap-2 space-y-0">
              <Checkbox
                id="exchange-rate-recalculate"
                checked={recalculate}
                onCheckedChange={value => setRecalculate(!!value)}
                disabled={saving || !hasForeignProducts}
              />
              <FieldLabel htmlFor="exchange-rate-recalculate" className="cursor-pointer">
                Recalcular los precios de productos en otra moneda
              </FieldLabel>
            </Field>
            <FieldDescription>
              {hasForeignProducts
                ? 'Los importes ya expresados en la moneda del documento no se tocan.'
                : `Todas las líneas están en ${currencyCode}: la tasa sólo cambia el equivalente en ${baseCode}.`}
            </FieldDescription>
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Guardar tasa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
