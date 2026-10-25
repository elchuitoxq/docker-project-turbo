import { PartnerStatementView } from '@/modules/partners/components/partner-statement-view';

type Params = Promise<{ id: string }>;

export default async function PartnerStatementPage({ params }: { params: Params }) {
  const { id } = await params;
  return <PartnerStatementView partnerId={id} />;
}
