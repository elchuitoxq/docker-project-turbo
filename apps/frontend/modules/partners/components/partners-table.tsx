'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Trash2, FileText } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Partner, PartnerType } from '../types';

const TYPE_LABEL: Record<PartnerType, string> = {
  CUSTOMER: 'Cliente',
  VENDOR: 'Proveedor',
};

const TYPE_VARIANT: Record<PartnerType, 'default' | 'secondary' | 'outline'> = {
  CUSTOMER: 'default',
  VENDOR: 'secondary',
};

type Props = {
  partners: Partner[];
  isLoading?: boolean;
  onEdit: (partner: Partner) => void;
  onDelete: (partner: Partner) => void;
  view?: 'table' | 'cards';
};

export function PartnersTable({ partners, isLoading, onEdit, onDelete, view = 'table' }: Props) {
  if (view === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {partners.map(p => (
          <PartnerCard key={p.id} partner={p} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>RIF</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="hidden md:table-cell">Teléfono</TableHead>
            <TableHead className="hidden lg:table-cell text-right">Límite de crédito</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7} className="h-12 animate-pulse bg-muted/30" />
              </TableRow>
            ))
          ) : partners.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                No se encontraron partners
              </TableCell>
            </TableRow>
          ) : (
            partners.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/operations/partners/${p.id}/statement`}
                    className="hover:underline"
                  >
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{p.taxId}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[p.type]}>{TYPE_LABEL[p.type]}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {p.email ?? '—'}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {p.phone ?? '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-right tabular-nums">
                  {Number(p.creditLimit).toFixed(2)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/operations/partners/${p.id}/statement`}>
                          <FileText /> Estado de cuenta
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(p)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(p)} className="text-destructive">
                        <Trash2 /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
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
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/dashboard/operations/partners/${partner.id}/statement`}
              className="block truncate font-medium hover:underline"
            >
              {partner.name}
            </Link>
            <p className="font-mono text-xs text-muted-foreground">{partner.taxId}</p>
          </div>
          <Badge variant={TYPE_VARIANT[partner.type]}>{TYPE_LABEL[partner.type]}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {partner.email && <span className="truncate">{partner.email}</span>}
          {partner.phone && <span>{partner.phone}</span>}
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(partner)}>
            <Pencil /> Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => onDelete(partner)}
          >
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
