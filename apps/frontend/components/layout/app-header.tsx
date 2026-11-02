'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen, LifeBuoy } from 'lucide-react';
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
import { guideTargetForPath } from '@/lib/guides/links';

export function AppHeader() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  const guideTarget = guideTargetForPath(pathname);

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
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              guideTarget
                ? `Guía de ${guideTarget.submodule?.title ?? guideTarget.module.title}`
                : 'Guías de uso'
            }
          >
            <LifeBuoy />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3 text-sm" align="end">
          {guideTarget ? (
            <>
              <div className="space-y-1">
                <h4 className="font-medium">
                  Guía de {guideTarget.submodule?.title ?? guideTarget.module.title}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {guideTarget.submodule?.summary ?? guideTarget.module.description}
                </p>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link href={guideTarget.href}>
                  <BookOpen />
                  Ver permisos y paso a paso
                </Link>
              </Button>
              <Link
                href="/dashboard/guides"
                className="block text-xs text-muted-foreground hover:text-foreground"
              >
                Todas las guías
              </Link>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <h4 className="font-medium">Guías de uso</h4>
                <p className="text-xs text-muted-foreground">
                  Esta pantalla todavía no tiene una guía asociada. Consulta el índice para ver los
                  procesos documentados.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href="/dashboard/guides">
                  <BookOpen />
                  Abrir el índice de guías
                </Link>
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>

      <ModeToggle />
    </header>
  );
}
