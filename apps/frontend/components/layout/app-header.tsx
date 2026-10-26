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

const LABELS: Record<string, string> = {
  dashboard: 'Panel',
  operations: 'Operaciones',
  inventory: 'Inventario',
  finance: 'Finanzas',
  hr: 'Recursos Humanos',
  settings: 'Configuración',
  partners: 'Clientes y Proveedores',
  sales: 'Ventas',
  purchases: 'Compras',
  orders: 'Pedidos',
  products: 'Productos',
  warehouses: 'Almacenes',
  moves: 'Movimientos',
  invoices: 'Facturación',
  treasury: 'Tesorería',
  'daily-close': 'Cierre diario',
  retentions: 'Retenciones',
  reports: 'Reportes',
  employees: 'Empleados',
  positions: 'Cargos',
  departments: 'Departamentos',
  payroll: 'Nómina',
  incidents: 'Novedades',
  users: 'Usuarios y Roles',
  branches: 'Sucursales',
  banks: 'Bancos',
  currencies: 'Monedas',
  'tax-concepts': 'Impuestos',
};

export function AppHeader() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map(segment => ({ slug: segment, label: LABELS[segment] ?? segment }));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => {
            const href = '/' + segments.slice(0, i + 1).join('/');
            const isLast = i === crumbs.length - 1;
            return (
              <React.Fragment key={href}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={href}>{crumb.label}</Link>
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
