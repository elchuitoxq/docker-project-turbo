'use client';

import { TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { useAuthStore } from '@/stores/use-auth-store';
import { formatDay, cn } from '@/lib/utils';
import { useRateHealth } from '@/lib/rates';

/** "2 h" / "3 d": la antigüedad se lee, no se calcula de cabeza. */
function ageLabel(ageHours: number | null): string {
  if (ageHours === null) return 'sin fecha';
  if (ageHours < 24) return `hace ${Math.max(1, Math.round(ageHours))} h`;
  const days = Math.round(ageHours / 24);
  return `hace ${days} d`;
}

/**
 * Tasa del día en el sidebar (`T-09-03`).
 *
 * Muestra **fuente** (BCV o manual) y **antigüedad**, y se pone ámbar cuando la tasa está vencida:
 * emitir o cobrar con una tasa vieja cambia el monto en moneda funcional.
 */
export function GlobalRateDisplay() {
  const isAuthed = useAuthStore(s => s.isAuthenticated);
  const { data, isLoading } = useRateHealth({ enabled: isAuthed });

  if (isLoading) {
    return (
      <div className="px-2">
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (!data || data.rate === null) return null;

  const sourceLabel = data.source === 'MANUAL' ? 'Manual' : 'BCV';
  const stale = data.isStale;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={`Tasa ${sourceLabel} de ${data.referenceCurrency ?? 'la moneda de referencia'} · ${data.date ? formatDay(data.date) : 'sin fecha'} · ${ageLabel(data.ageHours)}`}
          className={cn(
            'bg-muted/40 data-[state=open]:bg-sidebar-accent',
            stale && 'border border-amber-500/40 bg-amber-500/10'
          )}
        >
          <TrendingUp
            className={cn(
              'size-3.5',
              stale
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            )}
          />
          <div className="flex flex-col items-start gap-0 leading-tight">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {sourceLabel} · {data.referenceCurrency ?? 'tasa'}
              {stale ? ' · vencida' : ''}
            </span>
            <span className="text-xs font-semibold tabular-nums">
              Bs {data.rate.toFixed(2)}
              <span
                className={cn(
                  'ml-1 text-[10px] font-normal',
                  stale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                )}
                data-testid="rate-age"
              >
                · {ageLabel(data.ageHours)}
              </span>
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
