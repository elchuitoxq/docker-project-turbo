'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ListCard,
  ListEmptyRow,
  ListSkeletonRows,
  ListTd,
  ListTh,
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/list/list-table';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { ordersApi, type Order } from './orders-api';
import { OrderFormDialog } from './components/order-form-dialog';
import { formatMoney, formatDate } from '@/lib/utils';
import { useCurrencyIndex } from '@/lib/currency';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'En proceso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  // Estados heredados que aún existen en documentos de semillas antiguas.
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  INVOICED: 'Facturado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  CONFIRMED: 'outline',
  PROCESSING: 'default',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
  PENDING: 'secondary',
  APPROVED: 'default',
  INVOICED: 'outline',
};

export function OrdersView() {
  const { codeOf } = useCurrencyIndex();
  const { hasPermission } = usePermission();
  const [formOpen, setFormOpen] = React.useState(false);
  const canCreate = hasPermission(PERMISSIONS.OPERATIONS.ORDERS.CREATE);
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list({}),
  });

  const orders = data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Pedidos de venta y compra</p>
        </div>
        {canCreate && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus /> Nuevo pedido
          </Button>
        )}
      </div>

      <ListCard
        title="Listado"
        description={
          isLoading ? 'Cargando…' : `${orders.length} pedido${orders.length === 1 ? '' : 's'}`
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ListTh>Código</ListTh>
              <ListTh>Fecha</ListTh>
              <ListTh>Tipo</ListTh>
              <ListTh>Partner</ListTh>
              <ListTh>Estado</ListTh>
              <ListTh align="right">Total</ListTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <ListSkeletonRows cols={6} />
            ) : orders.length === 0 ? (
              <ListEmptyRow cols={6} message="No hay pedidos registrados." />
            ) : (
              orders.map(o => (
                <TableRow key={o.id}>
                  <ListTd mono>
                    <Link href={`/dashboard/operations/orders/${o.id}`} className="hover:underline">
                      {o.code}
                    </Link>
                  </ListTd>
                  <ListTd className="text-xs">{formatDate(o.orderDate)}</ListTd>
                  <ListTd>
                    <Badge variant={o.type === 'SALE' ? 'default' : 'secondary'}>
                      {o.type === 'SALE' ? 'Venta' : 'Compra'}
                    </Badge>
                  </ListTd>
                  <ListTd>{o.partnerName ?? '—'}</ListTd>
                  <ListTd>
                    <Badge variant={STATUS_VARIANT[o.status] ?? 'secondary'}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </Badge>
                  </ListTd>
                  <ListTd numeric>{formatMoney(Number(o.total), codeOf(o.currencyId))}</ListTd>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ListCard>

      {canCreate && <OrderFormDialog open={formOpen} onOpenChange={setFormOpen} />}
    </div>
  );
}
