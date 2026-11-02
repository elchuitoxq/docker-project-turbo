'use client';

import { use } from 'react';
import { InvoiceDetailView } from '@/modules/finance/components/invoice-detail-view';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <InvoiceDetailView
      invoiceId={id}
      backHref="/dashboard/finance/invoices"
      backLabel="Facturación"
    />
  );
}
