'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  Warehouse,
  Banknote,
  Users,
  Settings as SettingsIcon,
  LayoutDashboard,
  Search,
  Star,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NAV_ITEMS, type NavGroup } from '@/lib/navigation';
import { usePermission } from '@/hooks/use-permission';
import { useFavoritesStore } from '@/stores/use-favorites-store';
import { CompanyContextSwitcher } from './company-context-switcher';
import { NavUser } from './nav-user';
import { GlobalRateDisplay } from './global-rate-display';
import { useUiStore } from '@/stores/use-ui-store';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Briefcase,
  Warehouse,
  Banknote,
  Users,
  Settings: SettingsIcon,
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { hasPermission, hasAnyPermission } = usePermission();
  const favorites = useFavoritesStore(s => s.items);
  const removeFavorite = useFavoritesStore(s => s.remove);
  const toggleCommandPalette = useUiStore(s => s.toggleCommandPalette);

  const visibleGroups: NavGroup[] = NAV_ITEMS.filter(g => hasPermission(g.permission))
    .map(g => ({
      ...g,
      items: g.items?.filter(
        i => hasPermission(i.permission) && hasAnyPermission(i.anyPermissions)
      ),
    }))
    .filter(g => !g.items || g.items.length > 0 || !!g.url);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">ERP</span>
                  <span className="text-xs text-muted-foreground">v1.0</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <CompanyContextSwitcher className="mt-1" />
        <GlobalRateDisplay />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleCommandPalette} tooltip="Buscar (⌘K)">
              <Search />
              <span>Buscar…</span>
              <span className="ml-auto text-xs tracking-widest opacity-60">⌘K</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {favorites.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Star className="size-3.5" />
              Favoritos
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.map(fav => {
                  const isActive = pathname === fav.path;
                  return (
                    <SidebarMenuItem key={fav.path}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={fav.label}>
                        <Link href={fav.path}>
                          <Star className="size-3.5 fill-current opacity-70" />
                          <span>{fav.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleGroups.map(group => {
          const Icon = ICON_MAP[group.icon] ?? Briefcase;
          return (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel>
                <Icon />
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    {group.items && group.items.length > 0 ? (
                      <SidebarMenuSub>
                        {group.items.map(item => {
                          const isActive = pathname === item.url;
                          return (
                            <SidebarMenuSubItem key={item.url}>
                              <SidebarMenuSubButton asChild isActive={isActive}>
                                <Link href={item.url ?? '#'}>
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    ) : group.url ? (
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === group.url}
                        tooltip={group.title}
                      >
                        <Link href={group.url}>
                          <Icon />
                          <span>{group.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : null}
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
