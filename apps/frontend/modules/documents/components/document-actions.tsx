'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';

export type DocumentAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** Si falta el permiso, la acción se oculta; si el estado no lo permite, se deshabilita con motivo. */
  hidden?: boolean;
  disabled?: boolean;
  reason?: string;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  busy?: boolean;
};

/**
 * Acciones del documento según estado y permisos (`S-10`).
 *
 * Regla: **ocultar sólo por permiso**, **deshabilitar por estado** y explicar el motivo en el `title`.
 */
export function DocumentActions({ actions }: { actions: DocumentAction[] }) {
  const visible = actions.filter(action => !action.hidden);
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map(action => (
        <Button
          key={action.id}
          variant={action.variant ?? 'outline'}
          onClick={action.onClick}
          disabled={action.disabled || action.busy}
          title={action.disabled ? action.reason : undefined}
        >
          {action.icon}
          {action.busy ? 'Procesando…' : action.label}
        </Button>
      ))}
    </>
  );
}
