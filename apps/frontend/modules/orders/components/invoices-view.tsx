'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ListCard,
  ListEmptyRow,
  ListFilters,
  ListSkeletonRows,
  ListTd,
  ListTh,
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/list/list-table';
import { Search } from 'lucide-react';
import { invoicesApi, type Invoice } from '../api';
import { formatMoney, formatDate } from '@/lib/utils';
import { useCurrencyIndex } from '@/lib/currency';

type Props = {
  type: 'SALE' | 'PURCHASE';
  title: string;
  subtitle: string;
  /** Base de la ruta de detalle: el código de cada factura enlaza a su ficha (`S-10`). */
  detailBasePath?: string;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Emitida',
  VOID: 'Anulada',
  CANCELLED: 'Anulada',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  DRAFT: 'secondary',
  POSTED: 'default',
  VOID: 'destructive',
  CANCELLED: 'destructive',
};

export function InvoicesView({
  type,
  title,
  subtitle,
  detailBasePath = '/dashboard/finance/invoices',
}: Props) {
  const t = useTranslations('common');
  const { codeOf } = useCurrencyIndex();
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
      </div>

      <ListFilters>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código o partner…"
            className="pl-8"
          />
        </div>
        <Select
          value={status || 'ALL'}
          onValueChange={value => setStatus(value === 'ALL' ? '' : value)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="POSTED">Emitida</SelectItem>
            <SelectItem value="VOID">Anulada</SelectItem>
          </SelectContent>
        </Select>
      </ListFilters>

      <ListCard
        title="Listado"
        description={
          isLoading ? 'Cargando…' : `${filtered.length} factura${filtered.length === 1 ? '' : 's'}`
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ListTh>Código</ListTh>
              <ListTh>Fecha</ListTh>
              <ListTh>Partner</ListTh>
              <ListTh>Moneda</ListTh>
              <ListTh>Estado</ListTh>
              <ListTh align="right">Total</ListTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <ListSkeletonRows cols={6} />
            ) : filtered.length === 0 ? (
              <ListEmptyRow cols={6} message="No hay facturas para mostrar." />
            ) : (
              filtered.map(inv => (
                <TableRow key={inv.id}>
                  <ListTd mono>
                    <Link href={`${detailBasePath}/${inv.id}`} className="hover:underline">
                      {inv.code}
                    </Link>
                  </ListTd>
                  <ListTd className="text-xs">{formatDate(inv.date)}</ListTd>
                  <ListTd>{inv.partnerName ?? '—'}</ListTd>
                  <ListTd muted className="text-xs">
                    {codeOf(inv.currencyId)}
                  </ListTd>
                  <ListTd>
                    <Badge variant={STATUS_VARIANT[inv.status] ?? 'secondary'}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </Badge>
                  </ListTd>
                  <ListTd numeric>{formatMoney(Number(inv.total), codeOf(inv.currencyId))}</ListTd>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ListCard>

      <div className="flex items-center justify-end text-xs text-muted-foreground">
        {t('next')} →
      </div>
    </div>
  );
}
