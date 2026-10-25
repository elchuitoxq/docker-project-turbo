'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type ExchangeRate = {
  id: string;
  rate: number;
  date: string | null;
  source: string;
  currencyCode: string;
};

export function GlobalRateDisplay() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const { data, isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ['exchange-rate', 'current'],
    queryFn: () => apiClient.get<ExchangeRate[]>('/settings/currencies/rates/latest'),
    enabled: isAuthed,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="px-2">
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  const vesRate = data?.find((r) => r.currencyCode === 'VES');
  if (!vesRate) return null;

  const rate = vesRate.rate.toFixed(2);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={`Tasa BCV · ${vesRate.source}`}
          className="bg-muted/40 data-[state=open]:bg-sidebar-accent"
        >
          <TrendingUp className={cn('size-3.5 text-emerald-600 dark:text-emerald-400')} />
          <div className="flex flex-col items-start gap-0 leading-tight">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">BCV</span>
            <span className="text-xs font-semibold tabular-nums">Bs {rate}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
