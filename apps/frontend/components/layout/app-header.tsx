'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LifeBuoy } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CommandPalette } from './command-palette';
import { buildCrumbs } from '@/lib/breadcrumb';

export function AppHeader() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <React.Fragment key={crumb.href}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="truncate" title={crumb.slug}>
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <CommandPalette />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ayuda">
            <LifeBuoy />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm" align="end">
          <div className="space-y-2">
            <h4 className="font-medium">Ayuda contextual</h4>
            <p className="text-xs text-muted-foreground">
              Documentación de {crumbs[crumbs.length - 1]?.label ?? 'esta sección'} se mostrará
              aquí.
            </p>
          </div>
        </PopoverContent>
      </Popover>

      <ModeToggle />
    </header>
  );
}
