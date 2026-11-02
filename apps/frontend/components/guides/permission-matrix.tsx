import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { permissionMatrix } from '@/lib/guides/access';
import { GUIDE_ROLES } from '@/lib/guides/roles';
import type { AccessLevel, GuideModule } from '@/lib/guides/types';
import { ACCESS_LABEL, AccessDot, AccessLegend } from './access-badge';

const CELL_LABEL: Record<AccessLevel, string> = {
  full: 'Completo',
  partial: 'Parcial',
  none: '—',
};

export function PermissionMatrix({ module }: { module: GuideModule }) {
  const rows = permissionMatrix(module, GUIDE_ROLES);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">Matriz de acceso por rol</CardTitle>
        <CardDescription>
          Qué puede hacer cada rol por defecto en {module.title.toLowerCase()}. Los roles son
          configurables: un administrador puede ajustarlos en Configuración → Roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Rol</TableHead>
                {module.submodules.map(submodule => (
                  <TableHead key={submodule.id} className="whitespace-nowrap text-xs">
                    {submodule.title}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ role, cells }) => (
                <TableRow key={role.id}>
                  <TableCell className="sticky left-0 bg-card font-medium">
                    <span className="block text-sm">{role.label}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {role.id}
                    </span>
                  </TableCell>
                  {cells.map(cell => (
                    <TableCell key={cell.submoduleId} className="text-xs">
                      <span
                        className="inline-flex items-center gap-1.5"
                        title={ACCESS_LABEL[cell.level]}
                      >
                        <AccessDot level={cell.level} />
                        <span className="text-muted-foreground">{CELL_LABEL[cell.level]}</span>
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <AccessLegend />
      </CardContent>
    </Card>
  );
}
