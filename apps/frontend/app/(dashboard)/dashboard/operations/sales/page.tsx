import { InvoicesView } from '@/modules/orders/components/invoices-view';

export default function SalesPage() {
  return (
    <InvoicesView
      type="SALE"
      title="Ventas"
      subtitle="Facturas de venta emitidas y borradores"
      newHref="/dashboard/operations/sales"
    />
  );
}
