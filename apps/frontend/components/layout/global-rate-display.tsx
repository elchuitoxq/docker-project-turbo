'use client';

import { TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { useAuthStore } from '@/stores/use-auth-store';
import { cn } from '@/lib/utils';
import { findRate, isRateStale, useLatestRates } from '@/lib/rates';
import { RateAgeBadge } from '@/components/finance/stale-rate-gate';

export function GlobalRateDisplay() {
  const isAuthed = useAuthStore(s => s.isAuthenticated);
  const { data, isLoading } = useLatestRates({ enabled: isAuthed });

  if (isLoading) {
    return (
      <div className="px-2">
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  const vesRate = findRate(data, 'VES');
  if (!vesRate) return null;

  const stale = isRateStale(vesRate.date);
  const rate = vesRate.rate.toFixed(2);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={
            stale
              ? `Tasa vencida: ${vesRate.date ?? 'sin fecha'} · ${vesRate.source}`
              : `Tasa BCV · ${vesRate.source}`
          }
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
              BCV{stale ? ' · vencida' : ''}
            </span>
            <span className="text-xs font-semibold tabular-nums">Bs {rate}</span>
            <RateAgeBadge rate={vesRate} />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
