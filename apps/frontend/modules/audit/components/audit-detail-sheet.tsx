'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn, formatDateTime } from '@/lib/utils';
import { MODULE_LABELS, RESULT_LABELS, diffRows, type AuditLog } from '../api';

const RESULT_STYLES: Record<string, string> = {
  SUCCESS: 'border-emerald-600/40 text-emerald-700',
  DENIED: 'border-destructive/40 text-destructive',
  ERROR: 'border-amber-600/40 text-amber-700',
};

/**
 * Ficha completa de un registro de auditoría.
 *
 * Responde las cuatro preguntas del visor: quién, cuándo (con hora exacta), qué cambió campo por
 * campo y desde dónde se hizo.
 */
export function AuditDetailSheet({
  log,
  onClose,
  onFilterDocument,
}: {
  log: AuditLog | null;
  onClose: () => void;
  onFilterDocument?: (documentCode: string) => void;
}) {
  const rows = diffRows(log?.changes ?? null);
  const raw = log?.changes ? JSON.stringify(log.changes, null, 2) : '';

  return (
    <Sheet open={Boolean(log)} onOpenChange={open => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        {log && (
          <div className="flex h-full flex-col gap-4">
            <SheetHeader className="pr-6">
              <SheetTitle className="text-base leading-snug">{log.description ?? '—'}</SheetTitle>
              <SheetDescription>
                {formatDateTime(log.createdAt)} ·{' '}
                {MODULE_LABELS[log.module ?? ''] ?? log.module ?? '—'}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1 pr-3">
              <div className="flex flex-col gap-6 pb-6">
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Meta label="Acción" value={log.actionLabel ?? log.action} />
                  <Meta
                    label="Resultado"
                    value={
                      <Badge variant="outline" className={cn(RESULT_STYLES[log.result ?? ''])}>
                        {RESULT_LABELS[log.result ?? ''] ?? log.result ?? '—'}
                      </Badge>
                    }
                  />
                  <Meta label="Entidad" value={`${log.entityLabel ?? log.entityTable}`} />
                  <Meta label="Documento" value={log.documentCode ?? '—'} mono />
                  <Meta label="Estado del documento" value={log.documentStatus ?? '—'} />
                  <Meta
                    label="Duración"
                    value={log.durationMs === null ? '—' : `${log.durationMs} ms`}
                  />
                  <Meta label="Usuario" value={log.actorName ?? 'Sistema'} />
                  <Meta label="Correo" value={log.actorEmail ?? '—'} />
                  <Meta label="Rol" value={log.actorRoles?.join(', ') ?? '—'} />
                  <Meta
                    label="Hora exacta"
                    value={log.createdAt ? new Date(log.createdAt).toISOString() : '—'}
                    mono
                  />
                  <Meta label="IP" value={log.ipAddress ?? '—'} mono />
                  <Meta label="Ruta" value={log.route ?? '—'} mono />
                  <Meta label="Navegador" value={log.userAgent ?? '—'} mono />
                  <Meta label="Folio" value={log.id} mono />
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Qué cambió</h3>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Este registro no guarda un antes/después de campos.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Campo</th>
                            <th className="px-3 py-2 text-left font-medium">Antes</th>
                            <th className="px-3 py-2 text-left font-medium">Después</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(row => (
                            <tr key={row.field} className="border-t">
                              <td className="px-3 py-2 font-medium">{row.field}</td>
                              <td className="px-3 py-2 text-destructive line-through">
                                {row.before}
                              </td>
                              <td className="px-3 py-2 text-emerald-700">{row.after}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="flex flex-wrap gap-2">
                  {log.documentCode && onFilterDocument && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onFilterDocument(log.documentCode as string)}
                    >
                      Ver todo el documento
                    </Button>
                  )}
                  {log.entityId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void navigator.clipboard?.writeText(log.entityId as string)}
                    >
                      Copiar ID de la entidad
                    </Button>
                  )}
                </section>

                {raw && (
                  <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Ver JSON original
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto text-xs text-muted-foreground">
                      {raw}
                    </pre>
                  </details>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Meta({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn('break-words text-sm', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}
