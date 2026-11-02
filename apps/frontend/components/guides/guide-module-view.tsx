'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Banknote,
  Search,
  Settings as SettingsIcon,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { usePermission } from '@/hooks/use-permission';
import {
  matchesQuery,
  modulePermissions,
  moduleSummary,
  rolePermissions,
  submoduleAccess,
  type ModuleSummary,
} from '@/lib/guides/access';
import {
  getProgressServerSnapshot,
  getProgressSnapshot,
  subscribeProgress,
  toggleProgress,
} from '@/lib/guides/progress-store';
import { findRole } from '@/lib/guides/roles';
import type { GuideModule } from '@/lib/guides/types';
import { PermissionMatrix } from './permission-matrix';
import {
  CUSTOM_SELECTION,
  PermissionSimulator,
  REAL_USER,
  type SimulatorSelection,
} from './permission-simulator';
import { SubmoduleCard } from './submodule-card';
import { AccessBadge, AccessDot, AccessLegend } from './access-badge';

const MODULE_ICON: Record<GuideModule['icon'], LucideIcon> = {
  Warehouse,
  Briefcase,
  Banknote,
  Users,
  Settings: SettingsIcon,
};

export function GuideModuleView({ module }: { module: GuideModule }) {
  const { permissions } = usePermission();
  const [simulated, setSimulated] = React.useState<string[] | null>(null);
  const [selection, setSelection] = React.useState<SimulatorSelection>(REAL_USER);
  const [query, setQuery] = React.useState('');
  const reviewed = React.useSyncExternalStore(
    React.useCallback(callback => subscribeProgress(module.id, callback), [module.id]),
    React.useCallback(() => getProgressSnapshot(module.id), [module.id]),
    getProgressServerSnapshot
  );

  // Los enlaces desde el buscador llegan con `#submodulo`: el navegador no siempre lo respeta
  // cuando el contenido se hidrata después.
  React.useEffect(() => {
    const target = window.location.hash.slice(1);
    if (!target) return;
    document.getElementById(target)?.scrollIntoView({ block: 'start' });
  }, [module.id]);

  const granted = React.useMemo(
    () => new Set<string>(simulated ?? permissions),
    [simulated, permissions]
  );
  const summary = moduleSummary(granted, module);
  const permissionCodes = React.useMemo(() => modulePermissions(module), [module]);
  const visibleSubmodules = module.submodules.filter(submodule => matchesQuery(submodule, query));
  const readPercent =
    module.submodules.length === 0
      ? 0
      : Math.round((reviewed.length / module.submodules.length) * 100);

  const handleSelectRole = (next: SimulatorSelection) => {
    setSelection(next);
    if (next === REAL_USER) {
      setSimulated(null);
      return;
    }
    if (next === CUSTOM_SELECTION) return;
    const role = findRole(next);
    setSimulated(role ? rolePermissions(role) : null);
  };

  const handleTogglePermission = (code: string, checked: boolean) => {
    setSelection(CUSTOM_SELECTION);
    setSimulated(current => {
      const next = new Set(current ?? permissions);
      if (checked) next.add(code);
      else next.delete(code);
      return [...next];
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard/guides"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Todas las guías
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ModuleIcon module={module} />
          <h1 className="text-2xl font-semibold tracking-tight">{module.title}</h1>
          <Badge variant="outline" className="font-mono text-xs">
            {module.permission}
          </Badge>
          {simulated && <Badge variant="secondary">Simulando permisos</Badge>}
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{module.description}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <AccessBadge level={moduleAccessLevel(summary)} />
            <span className="text-sm text-muted-foreground">
              {summary.full} con acceso completo · {summary.partial} parcial · {summary.none} sin
              acceso de {summary.total} submódulos
            </span>
            <Link
              href={module.href}
              className="ml-auto text-sm font-medium text-primary hover:underline"
            >
              Ir al módulo
            </Link>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progreso de lectura</span>
              <span>
                {reviewed.length} de {module.submodules.length} revisados
              </span>
            </div>
            <Progress value={readPercent} aria-label="Progreso de lectura de la guía" />
          </div>
          <AccessLegend />
        </CardContent>
      </Card>

      <PermissionSimulator
        permissions={permissionCodes}
        selection={selection}
        granted={granted}
        isSimulating={simulated !== null}
        onSelectRole={handleSelectRole}
        onTogglePermission={handleTogglePermission}
        onReset={() => {
          setSimulated(null);
          setSelection(REAL_USER);
        }}
      />

      <PermissionMatrix module={module} />

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Submódulos de {module.title}</CardTitle>
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
              placeholder="Buscar proceso, paso o permiso…"
              className="pl-9"
              aria-label="Buscar dentro de la guía"
            />
          </div>
          <nav aria-label={`Índice de ${module.title}`} className="flex flex-wrap gap-2">
            {visibleSubmodules.map(submodule => {
              const checked = reviewed.includes(submodule.id);
              return (
                <a
                  key={submodule.id}
                  href={`#${submodule.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-muted"
                >
                  <AccessDot level={submoduleAccess(granted, submodule)} />
                  {submodule.title}
                  {checked && (
                    <span aria-label="revisado" className="text-emerald-600">
                      ✓
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {visibleSubmodules.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay procesos que coincidan con «{query}». Prueba con el nombre de la acción o el
            código de permiso.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleSubmodules.map(submodule => (
            <SubmoduleCard
              key={submodule.id}
              submodule={submodule}
              moduleTitle={module.title}
              granted={granted}
              reviewed={reviewed.includes(submodule.id)}
              onToggleReviewed={id => toggleProgress(module.id, id)}
            />
          ))}
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-2 py-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <BookOpen className="size-4" aria-hidden />
            Esta guía se genera desde{' '}
            <code className="font-mono text-xs">lib/guides/registry.ts</code>. Si cambias permisos
            en el backend, actualiza el contenido aquí para que la guía siga siendo fiel al sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function moduleAccessLevel(summary: ModuleSummary): 'full' | 'partial' | 'none' {
  if (summary.total > 0 && summary.full === summary.total) return 'full';
  if (summary.none === summary.total) return 'none';
  return 'partial';
}

function ModuleIcon({ module }: { module: GuideModule }) {
  const Icon = MODULE_ICON[module.icon];
  return (
    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
