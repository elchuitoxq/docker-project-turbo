'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Lock,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { canOpenSubmodule, submoduleAccess } from '@/lib/guides/access';
import type { GuideSubmodule } from '@/lib/guides/types';
import { cn } from '@/lib/utils';
import { ACCESS_HINT, AccessBadge } from './access-badge';

type Props = {
  submodule: GuideSubmodule;
  moduleTitle: string;
  granted: ReadonlySet<string>;
  reviewed: boolean;
  onToggleReviewed: (id: string) => void;
};

export function SubmoduleCard({
  submodule,
  moduleTitle,
  granted,
  reviewed,
  onToggleReviewed,
}: Props) {
  const level = submoduleAccess(granted, submodule);
  const canOpen = canOpenSubmodule(granted, submodule);
  const required =
    submodule.viewPermission ??
    submodule.viewAnyPermissions?.join(' o ') ??
    'sin permiso específico';

  return (
    <Card id={submodule.id} className="scroll-mt-24">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {submodule.title}
            <AccessBadge level={level} />
            {reviewed && (
              <Badge variant="outline" className="gap-1 text-emerald-600">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Revisado
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {canOpen && (
              <Link
                href={submodule.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Abrir pantalla
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={reviewed}
                onCheckedChange={() => onToggleReviewed(submodule.id)}
                aria-label={`Marcar ${submodule.title} como revisado`}
              />
              Revisado
            </label>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{submodule.summary}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {!canOpen && (
          <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>
              <span className="font-medium">No puedes abrir esta pantalla.</span> {ACCESS_HINT.none}{' '}
              Necesitas{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{required}</code>.
              Solicítalo a un administrador en Configuración → Usuarios.
            </p>
          </div>
        )}

        <section aria-label={`Acciones de ${submodule.title}`}>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <BookOpenCheck className="size-3.5" aria-hidden />
            Qué puedes hacer
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {submodule.actions.map(action => {
              const allowed = granted.has(action.permission);
              return (
                <li
                  key={`${action.label}-${action.permission}`}
                  className={cn(
                    'flex items-start gap-2 rounded-md border p-2.5 text-sm',
                    allowed ? 'bg-muted/30' : 'opacity-70'
                  )}
                >
                  {allowed ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-600"
                      aria-label="Permitido"
                    />
                  ) : (
                    <Lock
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-label="Bloqueado"
                    />
                  )}
                  <span className="flex flex-col gap-1">
                    <span className={cn(!allowed && 'text-muted-foreground')}>{action.label}</span>
                    <code className="font-mono text-[11px] text-muted-foreground">
                      {action.permission}
                    </code>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <Separator />

        <div className="grid gap-5 md:grid-cols-2">
          <section aria-label={`Paso a paso de ${submodule.title}`}>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Workflow className="size-3.5" aria-hidden />
              Paso a paso
            </h3>
            <ol className="flex flex-col gap-2">
              {submodule.steps.map((step, index) => (
                <li key={step} className="flex gap-2 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label={`Reglas de ${submodule.title}`}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reglas de negocio
            </h3>
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm">
              {submodule.rules.map(rule => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-label={`Errores frecuentes de ${submodule.title}`}>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CircleAlert className="size-3.5" aria-hidden />
            Errores frecuentes
          </h3>
          <ul className="flex flex-col gap-2">
            {submodule.pitfalls.map(pitfall => (
              <li key={pitfall.symptom} className="rounded-md border p-2.5 text-sm">
                <p className="font-medium">{pitfall.symptom}</p>
                <p className="text-muted-foreground">{pitfall.cause}</p>
              </li>
            ))}
          </ul>
        </section>

        {submodule.caution && (
          <div
            role="note"
            className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <p>
              <span className="font-medium">Acción irreversible. </span>
              {submodule.caution}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Módulo: {moduleTitle} · Permiso de entrada: <code className="font-mono">{required}</code>
        </p>
      </CardContent>
    </Card>
  );
}
