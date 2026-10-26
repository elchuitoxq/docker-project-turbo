'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ordersApi, type Order } from './orders-api';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_LABEL: Record<Order['status'], string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  INVOICED: 'Facturado',
  CANCELLED: 'Cancelado',
};

const STATUS_VARIANT: Record<Order['status'], 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    PENDING: 'secondary',
    APPROVED: 'default',
    INVOICED: 'outline',
    CANCELLED: 'destructive',
  };

export function OrdersView() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list({}),
  });

  const orders = data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Pedidos de venta y compra</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            {isLoading ? 'Cargando…' : `${orders.length} pedido${orders.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay pedidos</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.code}</TableCell>
                    <TableCell className="text-xs">{formatDate(o.orderDate)}</TableCell>
                    <TableCell>
                      <Badge variant={o.type === 'SALE' ? 'default' : 'secondary'}>
                        {o.type === 'SALE' ? 'Venta' : 'Compra'}
                      </Badge>
                    </TableCell>
                    <TableCell>{o.partnerName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(o.total), o.currencyCode === 'VES' ? 'VES' : 'USD')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
