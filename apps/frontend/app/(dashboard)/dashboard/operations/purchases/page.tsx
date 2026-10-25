import { InvoicesView } from '@/modules/orders/components/invoices-view';

export default function PurchasesPage() {
  return (
    <InvoicesView
      type="PURCHASE"
      title="Compras"
      subtitle="Facturas de compra recibidas"
      newHref="/dashboard/operations/purchases"
    />
  );
}
