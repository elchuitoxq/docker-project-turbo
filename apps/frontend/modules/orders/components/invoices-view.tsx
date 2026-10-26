'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText } from 'lucide-react';
import { invoicesApi, type Invoice } from '../api';
import { formatCurrency, formatDate } from '@/lib/utils';

type Props = { type: 'SALE' | 'PURCHASE'; title: string; subtitle: string; newHref: string };

const STATUS_LABEL: Record<Invoice['status'], string> = {
  DRAFT: 'Borrador',
  POSTED: 'Emitida',
  VOID: 'Anulada',
};

const STATUS_VARIANT: Record<Invoice['status'], 'default' | 'secondary' | 'destructive'> = {
  DRAFT: 'secondary',
  POSTED: 'default',
  VOID: 'destructive',
};

export function InvoicesView({ type, title, subtitle, newHref }: Props) {
  const t = useTranslations('common');
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<string>('');
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', type, { search, status }],
    queryFn: () => invoicesApi.list({ type, ...(status ? { status } : {}) }),
  });

  const filtered = React.useMemo(() => {
    const list = data?.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      i => i.code.toLowerCase().includes(q) || (i.partnerName ?? '').toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button asChild>
          <Link href={newHref}>
            <FileText /> Nueva {type === 'SALE' ? 'venta' : 'compra'}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por código o partner…"
                className="pl-8"
              />
            </div>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="POSTED">Emitida</option>
              <option value="VOID">Anulada</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Cargando…'
              : `${filtered.length} factura${filtered.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay facturas para mostrar
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.code}</TableCell>
                    <TableCell className="text-xs">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell>{inv.partnerName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(
                        Number(inv.total),
                        inv.currencyCode === 'VES' ? 'VES' : 'USD'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end text-xs text-muted-foreground">
        {t('next')} →
      </div>
    </div>
  );
}
