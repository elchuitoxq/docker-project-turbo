import { ModuleStub } from '@/components/layout/module-stub';
export default function Page() {
  return (
    <ModuleStub
      title="Bancos"
      description="Catálogo de bancos y cuentas de la empresa"
      endpoint="GET /settings/banks"
    />
  );
}
