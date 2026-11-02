'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/lib/utils';
import { useCurrencyIndex } from '@/lib/currency';
import { convertAmount } from '@/lib/rates';
import { ProductCombobox } from '@/modules/inventory/components/product-combobox';
import type { Product } from '@/modules/inventory/types';

/** Línea en edición: el producto se guarda desnormalizado para no depender del catálogo al pintar. */
export type LineDraft = {
  key: string;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  /** Moneda en la que está el precio del producto; puede no coincidir con la del documento. */
  productCurrencyId: string | null;
  /** Código de esa moneda ya resuelto: permite convertir sin depender del catálogo. */
  productCurrencyCode: string | null;
  /** Precio de catálogo en la moneda del producto: reconvierte sin acumular redondeos. */
  listPrice: number | null;
  /** `true` si el usuario escribió el precio: cambiar moneda o tasa no debe pisarlo. */
  priceIsManual: boolean;
  quantity: number;
  price: number;
  taxRate: number;
  isExempt: boolean;
};

export function emptyLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    productId: null,
    productSku: null,
    productName: null,
    productCurrencyId: null,
    productCurrencyCode: null,
    listPrice: null,
    priceIsManual: false,
    quantity: 1,
    price: 0,
    taxRate: 16,
    isExempt: false,
  };
}

/** Convierte el producto elegido en una línea con su precio y su IVA por defecto. */
export function lineFromProduct(product: Product): LineDraft {
  return {
    key: crypto.randomUUID(),
    productId: product.id,
    productSku: product.sku,
    productName: product.name,
    productCurrencyId: product.currencyId ?? null,
    productCurrencyCode: null,
    listPrice: Number(product.price ?? 0),
    priceIsManual: false,
    quantity: 1,
    price: Number(product.price ?? 0),
    taxRate: Number(product.taxRate ?? 0),
    isExempt: product.isExempt,
  };
}

/**
 * Reconvierte a la moneda del documento las líneas con precio automático.
 *
 * Es lo que hace que un pedido o un borrador sigan a la tasa vigente cuando ésta o la moneda del
 * documento cambian; las líneas cuyo precio escribió el usuario no se tocan.
 */
export function convertLines(
  lines: LineDraft[],
  currencyCode: string,
  rateOf: (code: string) => number | null
): LineDraft[] {
  return lines.map(line => {
    if (line.priceIsManual || line.listPrice === null) return line;

    const price = convertAmount(
      line.listPrice,
      line.productCurrencyCode ?? currencyCode,
      currencyCode,
      rateOf
    );

    return price === null ? line : { ...line, price };
  });
}

type Props = {
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  currencyCode: string;
  /** Tasa de cada moneda contra la base, con la tasa del documento como referencia. */
  rateOf: (code: string) => number | null;
  /** Las facturas llevan IVA por línea; los pedidos no. */
  withTax?: boolean;
  disabled?: boolean;
  error?: string | null;
};

/**
 * Editor de líneas compartido por los formularios de pedido y de factura (`T-09-10`, `T-09-15`).
 *
 * Cada línea es producto + cantidad + precio (+ IVA en facturas). El producto se busca en el backend y
 * al elegirlo se copian su precio y su tasa, que el usuario puede ajustar.
 */
export function LineItemsEditor({
  lines,
  onChange,
  currencyCode,
  rateOf,
  withTax,
  disabled,
  error,
}: Props) {
  const { codeOf } = useCurrencyIndex();

  const patch = (key: string, changes: Partial<LineDraft>) => {
    onChange(lines.map(line => (line.key === key ? { ...line, ...changes } : line)));
  };

  const remove = (key: string) => {
    onChange(lines.filter(line => line.key !== key));
  };

  const add = () => {
    onChange([...lines, emptyLine()]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Líneas *</Label>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>
          <Plus /> Agregar línea
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Agrega al menos una línea con producto, cantidad y precio.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {lines.map((line, index) => {
            const lineTotal = line.quantity * line.price;
            // El precio de la línea va en la moneda del documento: si el producto está en otra, se
            // convierte con la tasa del documento y el usuario siempre puede escribir el suyo.
            const priceCurrency = line.productCurrencyCode;
            const isConverted = Boolean(priceCurrency && priceCurrency !== currencyCode);
            const rateMissing = isConverted && rateOf(priceCurrency as string) === null;

            return (
              <div
                key={line.key}
                className="grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-12 sm:items-start"
              >
                <div
                  className={`flex flex-col gap-1 ${withTax ? 'sm:col-span-4' : 'sm:col-span-6'}`}
                >
                  <Label htmlFor={`line-product-${line.key}`} className="text-xs">
                    Producto
                  </Label>
                  <ProductCombobox
                    id={`line-product-${line.key}`}
                    value={line.productId}
                    onChange={product => {
                      const next = lineFromProduct(product);
                      const productCurrency = product.currencyId
                        ? codeOf(product.currencyId)
                        : null;
                      const sourceCode = productCurrency ?? currencyCode;
                      const converted = convertAmount(next.price, sourceCode, currencyCode, rateOf);

                      patch(line.key, {
                        productId: next.productId,
                        productSku: next.productSku,
                        productName: next.productName,
                        productCurrencyId: next.productCurrencyId,
                        productCurrencyCode: productCurrency,
                        listPrice: next.price,
                        // Sin tasa no hay conversión posible: el precio queda a mano.
                        priceIsManual: converted === null,
                        price: converted ?? 0,
                        taxRate: next.taxRate,
                        isExempt: next.isExempt,
                      });
                    }}
                    disabled={disabled}
                    aria-invalid={!!error && !line.productId}
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label htmlFor={`line-qty-${line.key}`} className="text-xs">
                    Cantidad
                  </Label>
                  <Input
                    id={`line-qty-${line.key}`}
                    type="number"
                    min={0}
                    step="0.0001"
                    value={line.quantity}
                    onChange={event =>
                      patch(line.key, {
                        quantity: Number(event.target.value),
                      })
                    }
                    disabled={disabled}
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label htmlFor={`line-price-${line.key}`} className="text-xs">
                    Precio ({currencyCode})
                  </Label>
                  <Input
                    id={`line-price-${line.key}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.price}
                    onChange={event =>
                      patch(line.key, {
                        price: Number(event.target.value),
                        priceIsManual: true,
                      })
                    }
                    disabled={disabled}
                    aria-invalid={rateMissing}
                  />
                  {rateMissing && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">
                      No hay tasa de {priceCurrency}: escribe el precio en {currencyCode} o registra
                      la tasa.
                    </span>
                  )}
                  {isConverted && !rateMissing && !line.priceIsManual && (
                    <span className="text-[10px] text-muted-foreground">
                      Convertido desde {priceCurrency} con la tasa del documento.
                    </span>
                  )}
                </div>

                {withTax && (
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label htmlFor={`line-tax-${line.key}`} className="text-xs">
                      IVA %
                    </Label>
                    <Input
                      id={`line-tax-${line.key}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.taxRate}
                      onChange={event =>
                        patch(line.key, {
                          taxRate: Number(event.target.value),
                        })
                      }
                      disabled={disabled || line.isExempt}
                      title={line.isExempt ? 'Producto exento de IVA' : undefined}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 sm:col-span-2 sm:flex-col sm:items-end sm:pt-5">
                  <span className="text-sm font-medium tabular-nums">
                    {formatMoney(lineTotal, currencyCode)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar línea ${index + 1}`}
                    onClick={() => remove(line.key)}
                    disabled={disabled}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
