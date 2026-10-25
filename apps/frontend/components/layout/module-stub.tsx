import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export function ModuleStub({
  title,
  description,
  endpoint,
}: {
  title: string;
  description: string;
  endpoint?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Construction className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Pendiente de implementación</CardTitle>
          </div>
          <CardDescription>
            Este módulo forma parte del shell Foundation. La lógica de negocio se entrega en
            sub-proyectos posteriores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Endpoint backend de referencia: <code className="rounded bg-muted px-1 py-0.5">{endpoint ?? 'N/A'}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
