'use client';

import { use } from 'react';
import { InvoiceDetailView } from '@/modules/finance/components/invoice-detail-view';

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <InvoiceDetailView
      invoiceId={id}
      backHref="/dashboard/operations/sales"
      backLabel="Ventas"
      expectedType="SALE"
    />
  );
}
