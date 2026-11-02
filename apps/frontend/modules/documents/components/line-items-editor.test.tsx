import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  LineItemsEditor,
  convertLines,
  emptyLine,
  lineFromProduct,
  type LineDraft,
} from './line-items-editor';
import type { Product } from '@/modules/inventory/types';

// El editor consulta el catálogo de monedas para saber si el precio del producto está en otra divisa.
vi.mock('@/lib/currency', () => ({
  useCurrencyIndex: () => ({
    baseCode: 'VES',
    byId: new Map(),
    codeOf: (id?: string | null) => (id === 'usd-id' ? 'USD' : 'VES'),
    symbolOf: () => 'Bs.S',
  }),
}));

// El selector de productos hace su propia consulta al catálogo: aquí se prueba el editor de líneas.
vi.mock('@/modules/inventory/components/product-combobox', () => {
  const mockProduct = {
    id: 'p-1',
    sku: 'TEST-SKU-001',
    name: 'Test Product',
    description: null,
    categoryId: null,
    cost: '100.00',
    price: '100.00',
    isExempt: false,
    taxRate: '16.00',
    type: 'PHYSICAL',
    minStock: '10',
    hasBatches: false,
    currencyId: 'usd-id',
    createdAt: '2026-10-30T00:00:00.000Z',
    updatedAt: '2026-10-30T00:00:00.000Z',
  };

  return {
    ProductCombobox: ({
      id,
      onChange,
    }: {
      id?: string;
      onChange?: (product: typeof mockProduct) => void;
    }) => (
      <button id={id} type="button" onClick={() => onChange?.(mockProduct)}>
        Elegir producto
      </button>
    ),
  };
});

/** Tasa del sistema: base (VES) por 1 USD. */
const rateOf = (code: string) => (code === 'USD' ? 900 : 1);

const product: Product = {
  id: 'p-1',
  sku: 'TEST-SKU-001',
  name: 'Test Product',
  description: null,
  categoryId: null,
  cost: '100.00',
  price: '100.00',
  isExempt: false,
  taxRate: '16.00',
  type: 'PHYSICAL',
  minStock: '10',
  hasBatches: false,
  currencyId: 'usd-id',
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
};

describe('LineItemsEditor', () => {
  it('pide agregar una línea cuando el documento no tiene ninguna', () => {
    render(<LineItemsEditor lines={[]} onChange={vi.fn()} currencyCode="VES" rateOf={rateOf} />);

    expect(
      screen.getByText('Agrega al menos una línea con producto, cantidad y precio.')
    ).toBeInTheDocument();
  });

  it('nombra el precio con la moneda del documento', () => {
    render(
      <LineItemsEditor
        lines={[emptyLine()]}
        onChange={vi.fn()}
        currencyCode="USD"
        rateOf={rateOf}
        withTax
      />
    );

    expect(screen.getByText('Precio (USD)')).toBeInTheDocument();
    expect(screen.getByText('IVA %')).toBeInTheDocument();
  });

  it('no muestra columna de IVA en los pedidos', () => {
    render(
      <LineItemsEditor
        lines={[emptyLine()]}
        onChange={vi.fn()}
        currencyCode="VES"
        rateOf={rateOf}
      />
    );

    expect(screen.queryByText('IVA %')).not.toBeInTheDocument();
  });

  it('convierte el precio del producto a la moneda del documento al elegirlo', () => {
    const onChange = vi.fn();
    render(
      <LineItemsEditor
        lines={[emptyLine()]}
        onChange={onChange}
        currencyCode="VES"
        rateOf={rateOf}
      />
    );

    fireEvent.click(screen.getByText('Elegir producto'));

    const next = onChange.mock.calls[0][0] as LineDraft[];
    expect(next[0]).toMatchObject({
      productId: 'p-1',
      listPrice: 100,
      productCurrencyCode: 'USD',
      priceIsManual: false,
      // 100 USD × 900 = 90.000 VES
      price: 90000,
    });
    expect(screen.queryByText(/No hay tasa de USD/)).not.toBeInTheDocument();
  });

  it('avisa y deja el precio a mano cuando falta la tasa de la moneda del producto', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <LineItemsEditor
        lines={[emptyLine()]}
        onChange={onChange}
        currencyCode="VES"
        rateOf={() => null}
      />
    );

    fireEvent.click(screen.getByText('Elegir producto'));

    const next = onChange.mock.calls[0][0] as LineDraft[];
    expect(next[0]).toMatchObject({ price: 0, priceIsManual: true });

    rerender(
      <LineItemsEditor lines={next} onChange={onChange} currencyCode="VES" rateOf={() => null} />
    );
    expect(screen.getByText(/No hay tasa de USD/)).toBeInTheDocument();
  });
});

describe('convertLines', () => {
  it('reconvierte sólo las líneas con precio automático', () => {
    const automatic: LineDraft = {
      ...emptyLine(),
      productId: 'p-1',
      productCurrencyCode: 'USD',
      listPrice: 100,
      price: 90000,
    };
    const manual: LineDraft = { ...automatic, key: 'manual', price: 12345, priceIsManual: true };

    const converted = convertLines([automatic, manual], 'VES', (code: string) =>
      code === 'USD' ? 950 : 1
    );

    expect(converted[0].price).toBe(95000);
    expect(converted[1].price).toBe(12345);
  });
});

describe('lineFromProduct', () => {
  it('copia precio, IVA y moneda del producto', () => {
    const line = lineFromProduct(product);

    expect(line).toMatchObject({
      productId: 'p-1',
      productSku: 'TEST-SKU-001',
      productName: 'Test Product',
      productCurrencyId: 'usd-id',
      price: 100,
      taxRate: 16,
      quantity: 1,
    });
  });
});
