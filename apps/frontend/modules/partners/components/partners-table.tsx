'use client';

import * as React from 'react';
import Link from 'next/link';
import { Pencil, Trash2, FileText } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ListCard,
  ListEmptyRow,
  ListRowActions,
  ListSkeletonRows,
  ListTd,
  ListTh,
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/list/list-table';
import { useCurrencyIndex } from '@/lib/currency';
import { formatMoney } from '@/lib/utils';
import type { Partner, PartnerType } from '../types';
import { PERMISSIONS } from '@/lib/permissions';
import { usePermission } from '@/hooks/use-permission';

const TYPE_LABEL: Record<PartnerType, string> = {
  CUSTOMER: 'Cliente',
  VENDOR: 'Proveedor',
  BOTH: 'Cliente y proveedor',
};

const TYPE_VARIANT: Record<PartnerType, 'default' | 'secondary' | 'outline'> = {
  CUSTOMER: 'default',
  VENDOR: 'secondary',
  BOTH: 'outline',
};

type Props = {
  partners: Partner[];
  isLoading?: boolean;
  onEdit: (partner: Partner) => void;
  onDelete: (partner: Partner) => void;
  view?: 'table' | 'cards';
};

export function PartnersTable({ partners, isLoading, onEdit, onDelete, view = 'table' }: Props) {
  const { hasPermission } = usePermission();
  const { baseCode } = useCurrencyIndex();
  const canEdit = hasPermission(PERMISSIONS.OPERATIONS.PARTNERS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.OPERATIONS.PARTNERS.DELETE);
  const canViewStatement = hasPermission(PERMISSIONS.OPERATIONS.PARTNERS.STATEMENT);

  const columns = 7;
  const description = isLoading
    ? 'Cargando…'
    : `${partners.length} contacto${partners.length === 1 ? '' : 's'}`;

  if (view === 'cards') {
    return (
      <ListCard title="Directorio" description={description}>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          {partners.map(p => (
            <PartnerCard key={p.id} partner={p} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </ListCard>
    );
  }

  return (
    <ListCard title="Directorio" description={description}>
      <Table>
        <TableHeader>
          <TableRow>
            <ListTh>Nombre</ListTh>
            <ListTh>RIF</ListTh>
            <ListTh>Tipo</ListTh>
            <ListTh hide="md">Email</ListTh>
            <ListTh hide="md">Teléfono</ListTh>
            <ListTh align="right" hide="lg">
              Límite de crédito
            </ListTh>
            <ListTh className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <ListSkeletonRows cols={columns} />
          ) : partners.length === 0 ? (
            <ListEmptyRow cols={columns} message="No se encontraron clientes ni proveedores." />
          ) : (
            partners.map(p => (
              <TableRow key={p.id}>
                <ListTd className="font-medium">
                  {canViewStatement ? (
                    <Link
                      href={`/dashboard/operations/partners/${p.id}/statement`}
                      className="hover:underline"
                    >
                      {p.name}
                    </Link>
                  ) : (
                    p.name
                  )}
                </ListTd>
                <ListTd mono>{p.taxId}</ListTd>
                <ListTd>
                  <Badge variant={TYPE_VARIANT[p.type]}>{TYPE_LABEL[p.type]}</Badge>
                </ListTd>
                <ListTd hide="md" muted>
                  {p.email ?? '—'}
                </ListTd>
                <ListTd hide="md" muted>
                  {p.phone ?? '—'}
                </ListTd>
                <ListTd numeric hide="lg">
                  {formatMoney(Number(p.creditLimit), baseCode)}
                </ListTd>
                <ListTd className="w-12">
                  <ListRowActions label={`Acciones de ${p.name}`}>
                    {canViewStatement && (
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/operations/partners/${p.id}/statement`}>
                          <FileText /> Estado de cuenta
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <DropdownMenuItem onClick={() => onEdit(p)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem onClick={() => onDelete(p)} className="text-destructive">
                        <Trash2 /> Eliminar
                      </DropdownMenuItem>
                    )}
                  </ListRowActions>
                </ListTd>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ListCard>
  );
}

function PartnerCard({
  partner,
  onEdit,
  onDelete,
}: {
  partner: Partner;
  onEdit: (p: Partner) => void;
  onDelete: (p: Partner) => void;
}) {
  const { hasPermission } = usePermission();
  const canEdit = hasPermission(PERMISSIONS.OPERATIONS.PARTNERS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.OPERATIONS.PARTNERS.DELETE);
  const canViewStatement = hasPermission(PERMISSIONS.OPERATIONS.PARTNERS.STATEMENT);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {canViewStatement ? (
              <Link
                href={`/dashboard/operations/partners/${partner.id}/statement`}
                className="block truncate font-medium hover:underline"
              >
                {partner.name}
              </Link>
            ) : (
              <span className="block truncate font-medium">{partner.name}</span>
            )}
            <p className="font-mono text-xs text-muted-foreground">{partner.taxId}</p>
          </div>
          <Badge variant={TYPE_VARIANT[partner.type]}>{TYPE_LABEL[partner.type]}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {partner.email && <span className="truncate">{partner.email}</span>}
          {partner.phone && <span>{partner.phone}</span>}
        </div>
        {(canEdit || canDelete) && (
          <div className="flex gap-2 pt-2">
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onEdit(partner)}
              >
                <Pencil /> Editar
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => onDelete(partner)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
