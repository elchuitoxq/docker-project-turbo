import { Suspense } from 'react';
import { AuditView } from '@/modules/audit/components/audit-view';

export default function AuditPage() {
  // `AuditView` lee los filtros de la URL: Next exige un límite de suspensión para eso.
  return (
    <Suspense>
      <AuditView />
    </Suspense>
  );
}
