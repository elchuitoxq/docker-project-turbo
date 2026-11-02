'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Banknote,
  Briefcase,
  ChevronRight,
  GraduationCap,
  Search,
  Settings as SettingsIcon,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/hooks/use-permission';
import { moduleSummary, searchGuides } from '@/lib/guides/access';
import { GUIDE_MODULES } from '@/lib/guides/registry';
import { GUIDE_ROLES } from '@/lib/guides/roles';
import type { GuideModule } from '@/lib/guides/types';
import { AccessBadge, AccessLegend } from './access-badge';

const MODULE_ICON: Record<GuideModule['icon'], LucideIcon> = {
  Warehouse,
  Briefcase,
  Banknote,
  Users,
  Settings: SettingsIcon,
};

export function GuideIndexView() {
  const { permissions } = usePermission();
  const granted = React.useMemo(() => new Set(permissions), [permissions]);
  const [query, setQuery] = React.useState('');
  const results = React.useMemo(
    () => searchGuides(GUIDE_MODULES, granted, query),
    [granted, query]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <GraduationCap className="size-6" aria-hidden />
          Guías de uso
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Qué puedes hacer en cada submódulo según los permisos que te otorgaron, con el paso a paso
          de cada proceso y lo que necesitas solicitar cuando algo está bloqueado.
        </p>
      </div>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Buscar un proceso</CardTitle>
          <CardDescription>
            Busca por nombre, paso, regla o código de permiso en todas las guías.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Ej.: publicar factura, aprobar movimiento, finance:invoices:post"
              className="pl-9"
              aria-label="Buscar en las guías"
            />
          </div>
          {query.trim() && (
            <ul className="flex flex-col divide-y rounded-md border">
              {results.length === 0 && (
                <li className="px-3 py-4 text-sm text-muted-foreground">
                  Sin resultados para «{query.trim()}».
                </li>
              )}
              {results.map(result => (
                <li key={`${result.moduleId}-${result.submoduleId}`}>
                  <Link
                    href={`/dashboard/guides/${result.moduleId}#${result.submoduleId}`}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted"
                  >
                    <span className="text-xs text-muted-foreground">{result.moduleTitle}</span>
                    <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                    <span className="font-medium">{result.submoduleTitle}</span>
                    <div className="ml-auto">
                      <AccessBadge level={result.level} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GUIDE_MODULES.map(module => {
          const Icon = MODULE_ICON[module.icon];
          const summary = moduleSummary(granted, module);
          return (
            <Card key={module.id} className="flex flex-col">
              <CardHeader className="gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <CardTitle className="text-base">{module.title}</CardTitle>
                  <Badge variant="outline" className="ml-auto font-mono text-[11px]">
                    {module.permission}
                  </Badge>
                </div>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-3">
                <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md border p-2">
                    <dt className="text-muted-foreground">Completo</dt>
                    <dd className="text-lg font-semibold">{summary.full}</dd>
                  </div>
                  <div className="rounded-md border p-2">
                    <dt className="text-muted-foreground">Parcial</dt>
                    <dd className="text-lg font-semibold">{summary.partial}</dd>
                  </div>
                  <div className="rounded-md border p-2">
                    <dt className="text-muted-foreground">Sin acceso</dt>
                    <dd className="text-lg font-semibold">{summary.none}</dd>
                  </div>
                </dl>
                <Link
                  href={`/dashboard/guides/${module.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Ver guía de {module.title.toLowerCase()}
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Roles del sistema</CardTitle>
          <CardDescription>
            Referencia rápida de los roles por defecto. Un administrador puede ajustarlos en
            Configuración → Roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {GUIDE_ROLES.map(role => (
              <li key={role.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {role.label}
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {role.id}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{role.description}</p>
              </li>
            ))}
          </ul>
          <AccessLegend />
        </CardContent>
      </Card>
    </div>
  );
}
