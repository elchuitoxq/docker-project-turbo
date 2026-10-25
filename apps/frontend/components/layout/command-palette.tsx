'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Briefcase,
  Warehouse,
  Banknote,
  Users,
  Settings as SettingsIcon,
  Search,
  FileText,
  Receipt,
  Landmark,
  Package,
  ClipboardList,
  ShoppingCart,
  PackageOpen,
  Building2,
  PiggyBank,
  CircleDollarSign,
  Percent,
  type LucideIcon,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useUiStore } from '@/stores/use-ui-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { usePermission } from '@/hooks/use-permission';
import { NAV_ITEMS } from '@/lib/navigation';
import { apiClient } from '@/lib/api/client';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Briefcase,
  Warehouse,
  Banknote,
  Users,
  Settings: SettingsIcon,
  Receipt,
  Landmark,
  Package,
  ClipboardList,
  ShoppingCart,
  PackageOpen,
  Building2,
  PiggyBank,
  CircleDollarSign,
  Percent,
  FileText,
};

type SearchResult = {
  type: 'partner' | 'product' | 'invoice' | 'employee';
  id: string;
  title: string;
  subtitle?: string;
};

export function CommandPalette() {
  const open = useUiStore(s => s.commandPaletteOpen);
  const setOpen = useUiStore(s => s.setCommandPaletteOpen);
  const t = useTranslations('command');
  const router = useRouter();
  const isAuthed = useAuthStore(s => s.isAuthenticated);
  const { hasPermission, hasAnyPermission } = usePermission();
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  const { data: results = [] } = useQuery<SearchResult[]>({
    queryKey: ['search', query],
    queryFn: () => apiClient.get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`),
    enabled: isAuthed && query.length >= 2,
    staleTime: 30_000,
  });

  function navigate(path: string) {
    setOpen(false);
    setQuery('');
    router.push(path);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('placeholder')} value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>
        {NAV_ITEMS.filter(g => hasPermission(g.permission)).map(group => {
          const GroupIcon = ICON_MAP[group.icon] ?? Briefcase;
          return (
            <CommandGroup key={group.title} heading={group.title}>
              {group.url && (
                <CommandItem onSelect={() => navigate(group.url!)}>
                  <GroupIcon />
                  <span>{group.title}</span>
                </CommandItem>
              )}
              {group.items
                ?.filter(i => hasPermission(i.permission) && hasAnyPermission(i.anyPermissions))
                .map(item => {
                  const Icon = ICON_MAP[item.icon ?? ''] ?? FileText;
                  return (
                    <CommandItem key={item.url} onSelect={() => navigate(item.url)}>
                      <Icon />
                      <span>{item.title}</span>
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          );
        })}
        {results.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Resultados">
              {results.map(r => (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  onSelect={() => {
                    const path =
                      r.type === 'partner'
                        ? `/dashboard/operations/partners/${r.id}/statement`
                        : r.type === 'product'
                          ? '/dashboard/inventory/products'
                          : r.type === 'invoice'
                            ? '/dashboard/finance/invoices'
                            : '/dashboard/hr/employees';
                    navigate(path);
                  }}
                >
                  <Search />
                  <div className="flex flex-col">
                    <span>{r.title}</span>
                    {r.subtitle && (
                      <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
