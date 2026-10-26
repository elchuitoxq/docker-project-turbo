'use client';

import * as React from 'react';
import { Plus, Search, LayoutGrid, List, Filter } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { usePartners, useDeletePartner } from '../hooks/use-partners';
import { PartnersTable } from './partners-table';
import { PartnerDialog } from './partner-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import type { Partner, PartnerType } from '../types';
import { useIsMobile } from '@/hooks/use-mobile';

export function PartnersView() {
  const t = useTranslations('common');
  const isMobile = useIsMobile();
  const { hasPermission } = usePermission();
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<PartnerType | 'ALL'>('ALL');
  const [viewMode, setViewMode] = React.useState<'table' | 'cards'>('table');
  const [page, setPage] = React.useState(1);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partner | null>(null);

  const view = isMobile ? 'cards' : viewMode;

  const filters = React.useMemo(
    () => ({
      page,
      limit: 20,
      ...(search && { search }),
      ...(type !== 'ALL' && { type }),
    }),
    [page, search, type]
  );

  const { data, isLoading } = usePartners(filters);
  const del = useDeletePartner();

  function handleEdit(p: Partner) {
    setEditing(p);
    setDialogOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function handleDelete(p: Partner) {
    if (window.confirm(`¿Eliminar a ${p.name}?`)) {
      del.mutate(p.id, {
        onSuccess: () => toast.success('Partner eliminado'),
        onError: () => toast.error('Error al eliminar'),
      });
    }
  }

  const partners = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes y Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            {total} partner{total === 1 ? '' : 's'} registrado{total === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={v => v && setViewMode(v as 'table' | 'cards')}
              size="sm"
            >
              <ToggleGroupItem value="table" aria-label="Tabla">
                <List />
              </ToggleGroupItem>
              <ToggleGroupItem value="cards" aria-label="Cards">
                <LayoutGrid />
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {hasPermission(PERMISSIONS.OPERATIONS.PARTNERS.CREATE) && (
            <Button onClick={handleNew}>
              <Plus /> Nuevo
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nombre o RIF…"
                className="pl-8"
              />
            </div>
            {isMobile ? (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-auto">
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                    <SheetDescription>Refina la búsqueda</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4">
                    <Select value={type} onValueChange={v => setType(v as PartnerType | 'ALL')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        <SelectItem value="CUSTOMER">Clientes</SelectItem>
                        <SelectItem value="VENDOR">Proveedores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <Select value={type} onValueChange={v => setType(v as PartnerType | 'ALL')}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los tipos</SelectItem>
                  <SelectItem value="CUSTOMER">Clientes</SelectItem>
                  <SelectItem value="VENDOR">Proveedores</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      <PartnersTable
        partners={partners}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        view={view}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      <PartnerDialog open={dialogOpen} onOpenChange={setDialogOpen} partner={editing} />
    </div>
  );
}
