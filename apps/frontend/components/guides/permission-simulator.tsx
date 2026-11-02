'use client';

import { FlaskConical, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GUIDE_ROLES } from '@/lib/guides/roles';
import type { GuideRoleId } from '@/lib/guides/types';

export const REAL_USER = 'REAL' as const;
export const CUSTOM_SELECTION = 'CUSTOM' as const;

export type SimulatorSelection = typeof REAL_USER | typeof CUSTOM_SELECTION | GuideRoleId;

type Props = {
  /** Códigos de permiso que usa el módulo documentado. */
  permissions: readonly string[];
  /** Selección actual del simulador. */
  selection: SimulatorSelection;
  granted: ReadonlySet<string>;
  isSimulating: boolean;
  onSelectRole: (selection: SimulatorSelection) => void;
  onTogglePermission: (code: string, checked: boolean) => void;
  onReset: () => void;
};

export function PermissionSimulator({
  permissions,
  selection,
  granted,
  isSimulating,
  onSelectRole,
  onTogglePermission,
  onReset,
}: Props) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="size-4" aria-hidden />
          Simulador de permisos
          {isSimulating && (
            <Badge variant="secondary" className="ml-1">
              Simulación
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Cambia el rol o marca permisos para ver en vivo qué se habilita. No modifica tus permisos
          reales: es una vista previa de la guía.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={selection}
            onValueChange={value => onSelectRole(value as SimulatorSelection)}
          >
            <SelectTrigger className="sm:w-72" aria-label="Ver la guía como">
              <SelectValue placeholder="Ver como" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={REAL_USER}>Mi usuario (permisos reales)</SelectItem>
              {GUIDE_ROLES.map(role => (
                <SelectItem key={role.id} value={role.id}>
                  {role.label}
                </SelectItem>
              ))}
              {selection === CUSTOM_SELECTION && (
                <SelectItem value={CUSTOM_SELECTION}>Selección personalizada</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={onReset} disabled={!isSimulating}>
            <RotateCcw className="size-4" aria-hidden />
            Volver a mis permisos
          </Button>
        </div>

        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Permisos del módulo
          </legend>
          {permissions.map(code => {
            const id = `perm-${code.replaceAll(':', '-')}`;
            return (
              <label
                key={code}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  id={id}
                  checked={granted.has(code)}
                  onCheckedChange={checked => onTogglePermission(code, checked === true)}
                />
                <code className="font-mono text-xs">{code}</code>
              </label>
            );
          })}
        </fieldset>
      </CardContent>
    </Card>
  );
}
