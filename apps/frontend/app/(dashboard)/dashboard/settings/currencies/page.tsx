import { ModuleStub } from '@/components/layout/module-stub';
export default function Page() {
  return (
    <ModuleStub
      title="Monedas"
      description="Monedas y tasas de cambio"
      endpoint="GET /settings/currencies"
    />
  );
}
