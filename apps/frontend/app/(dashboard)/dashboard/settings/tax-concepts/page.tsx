import { ModuleStub } from '@/components/layout/module-stub';
export default function Page() {
  return (
    <ModuleStub
      title="Conceptos de impuestos"
      description="ISLR, IVA, IGTF y otros conceptos fiscales"
      endpoint="GET /settings/tax-concepts"
    />
  );
}
