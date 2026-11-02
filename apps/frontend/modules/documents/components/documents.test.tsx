import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentTotals } from './document-totals';
import { DocumentActions } from './document-actions';
import { DocumentLines } from './document-lines';
import { DocumentTimeline } from './document-timeline';
import type { DocumentEvent, DocumentLine } from '../types';

const lines: DocumentLine[] = [
  {
    id: 'l-1',
    productId: 'p-1',
    productSku: 'ELEC-001',
    productName: 'Cable HDMI',
    quantity: 2,
    price: 50,
    taxRate: 16,
    total: 100,
  },
];

describe('DocumentLines', () => {
  it('muestra SKU, nombre y montos en la moneda del documento', () => {
    render(<DocumentLines items={lines} currencyCode="VES" />);

    expect(screen.getByText('ELEC-001')).toBeInTheDocument();
    expect(screen.getByText('Cable HDMI')).toBeInTheDocument();
    // Regresión de DEF-016: el monto se pinta en VES, no en USD por defecto.
    expect(screen.getAllByText(/Bs/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('avisa cuando el documento no tiene líneas', () => {
    render(<DocumentLines items={[]} currencyCode="VES" />);
    expect(screen.getByText('El documento no tiene líneas.')).toBeInTheDocument();
  });
});

describe('DocumentTotals', () => {
  it('muestra el total dual con la tasa del documento y el saldo del backend', () => {
    render(
      <DocumentTotals
        totalBase={100}
        totalTax={16}
        totalIgtf={3.48}
        total={119.48}
        currencyCode="USD"
        exchangeRate={36.5}
        settlement={{
          total: 119.48,
          paid: 19.48,
          credited: 0,
          retained: 0,
          settled: 19.48,
          balance: 100,
        }}
      />
    );

    // Total en su moneda + equivalente en base a la tasa congelada (119,48 × 36,50 = 4.361,02).
    expect(screen.getByText(/119,48/)).toBeInTheDocument();
    expect(screen.getByText(/4\.361,02/)).toBeInTheDocument();
    expect(screen.getByText('Saldo')).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    expect(screen.getByText('Tasa del documento 36.50 · USD')).toBeInTheDocument();
  });

  it('omite el IGTF cuando no se aplicó', () => {
    render(
      <DocumentTotals
        totalBase={100}
        totalTax={16}
        totalIgtf={0}
        total={116}
        currencyCode="VES"
        exchangeRate={1}
      />
    );

    expect(screen.queryByText('IGTF')).not.toBeInTheDocument();
    expect(screen.queryByText('Saldo')).not.toBeInTheDocument();
  });

  it('omite el equivalente en moneda funcional cuando el documento no es fiscal', () => {
    render(
      <DocumentTotals
        totalBase={100}
        totalTax={0}
        totalIgtf={0}
        total={100}
        currencyCode="USD"
        exchangeRate={36.5}
        issueLabel="Total del pedido"
        showBaseEquivalent={false}
      />
    );

    // Base imponible y total, ambos en la moneda del documento.
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0);
    // Un pedido en USD no publica su equivalente en Bs: no es un documento fiscal.
    expect(screen.queryByText(/3\.650,00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tasa del documento/)).not.toBeInTheDocument();
  });
});

describe('DocumentActions', () => {
  it('oculta por permiso y deshabilita por estado con motivo', () => {
    const post = vi.fn();
    const voidInvoice = vi.fn();

    render(
      <DocumentActions
        actions={[
          { id: 'post', label: 'Postear', onClick: post },
          {
            id: 'void',
            label: 'Anular',
            onClick: voidInvoice,
            disabled: true,
            reason: 'Sólo se anula una factura emitida',
          },
          { id: 'delete', label: 'Borrar', onClick: vi.fn(), hidden: true },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: 'Postear' })).toBeEnabled();
    const voidButton = screen.getByRole('button', { name: 'Anular' });
    expect(voidButton).toBeDisabled();
    expect(voidButton).toHaveAttribute('title', 'Sólo se anula una factura emitida');
    expect(screen.queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument();
  });
});

describe('DocumentTimeline', () => {
  const history: DocumentEvent[] = [
    {
      id: 'e-1',
      documentType: 'ORDER',
      documentId: 'order-1',
      documentCode: 'ORD-000001',
      parentDocumentId: null,
      action: 'ORDER_CREATED',
      fromStatus: null,
      toStatus: 'DRAFT',
      description: 'Venta · 1 línea',
      metadata: null,
      userId: 'u-1',
      userName: 'Test Manager',
      createdAt: '2026-10-30T18:22:00.000Z',
    },
    {
      id: 'e-2',
      documentType: 'ORDER',
      documentId: 'order-1',
      documentCode: 'ORD-000001',
      parentDocumentId: null,
      action: 'ORDER_CONFIRMED',
      fromStatus: 'DRAFT',
      toStatus: 'CONFIRMED',
      description: null,
      metadata: null,
      userId: 'u-1',
      userName: 'Test Manager',
      createdAt: '2026-10-30T18:25:00.000Z',
    },
    {
      id: 'e-3',
      documentType: 'INVOICE',
      documentId: 'invoice-1',
      documentCode: 'A-00021',
      parentDocumentId: 'order-1',
      action: 'INVOICE_POSTED',
      fromStatus: 'DRAFT',
      toStatus: 'POSTED',
      description: null,
      metadata: null,
      userId: 'u-2',
      userName: 'Ana Contable',
      createdAt: '2026-10-30T18:40:00.000Z',
    },
  ];

  it('lista cada paso con fecha, hora y usuario, y marca la transición de estado', () => {
    render(<DocumentTimeline events={history} currentDocumentId="invoice-1" />);

    expect(screen.getByText('Histórico de procesos')).toBeInTheDocument();
    expect(screen.getByText('3 movimientos · del más antiguo al más reciente')).toBeInTheDocument();

    // Etiquetas legibles por acción, no el código interno.
    expect(screen.getByText('Pedido creado')).toBeInTheDocument();
    expect(screen.getByText('Pedido confirmado')).toBeInTheDocument();
    expect(screen.getByText('Factura emitida')).toBeInTheDocument();

    // Autor y fecha con hora: lo que faltaba para auditar el documento.
    expect(screen.getAllByText('Test Manager')).toHaveLength(2);
    expect(screen.getByText('Ana Contable')).toBeInTheDocument();
    expect(screen.getAllByText(/30\/10\/2026, \d{2}:\d{2}/)).toHaveLength(3);

    // El paso de la factura no se marca como "de otro documento"; los del pedido sí.
    expect(screen.queryByText('Factura A-00021')).not.toBeInTheDocument();
    expect(screen.getAllByText('Pedido ORD-000001')).toHaveLength(2);
  });

  it('avisa cuando el documento todavía no tiene movimientos', () => {
    render(<DocumentTimeline events={[]} currentDocumentId="order-1" />);

    expect(screen.getByText('Sin movimientos registrados')).toBeInTheDocument();
    expect(
      screen.getByText('Este documento no tiene movimientos registrados.')
    ).toBeInTheDocument();
  });
});
