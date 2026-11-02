'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Warehouse } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  ListSkeletonRows,
  ListTd,
  ListTh,
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/list/list-table';
import { apiClient } from '@/lib/api/client';

type StockRow = {
  id: string;
  warehouseId: string;
  productId: string;
  quantity?: string | null;
  productName?: string;
  productSku?: string;
  batchNumber?: string;
  minStock?: string | null;
  belowMinimum: boolean;
  /** Costo promedio móvil del producto (`S-25`). */
  averageCost?: string | null;
  /** Cantidad × costo promedio. */
  totalValue?: string | null;
};

/**
 * Stock por almacén con alertas de mínimo (`T-07-06`).
 *
 * El mínimo sale de `products.min_stock`; el backend marca `belowMinimum` para que la alerta no
 * dependa de una regla duplicada en el cliente.
 */
export function StockView() {
  const [warehouseId, setWarehouseId] = React.useState('');
  const [onlyLow, setOnlyLow] = React.useState(false);

  const warehouses = useQuery({
    // `inventory:products:view` habilita Stock pero no el catálogo de almacenes: se usa el
    // endpoint de opciones para que el selector no quede vacío ni responda 403.
    queryKey: ['inventory', 'warehouse-options'],
    queryFn: () => apiClient.get<{ id: string; name: string }[]>('/inventory/warehouses/options'),
  });

  const activeWarehouseId = warehouseId || (warehouses.data?.[0]?.id ?? '');

  const stock = useQuery({
    queryKey: ['stock', activeWarehouseId],
    queryFn: () => apiClient.get<StockRow[]>(`/inventory/stock/${activeWarehouseId}`),
    enabled: Boolean(activeWarehouseId),
  });

  const rows = stock.data ?? [];
  const low = rows.filter(row => row.belowMinimum);
  const visible = onlyLow ? low : rows;
  const warehouseList = warehouses.data ?? [];

  if (!warehouses.isLoading && warehouseList.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock por almacén</h1>
          <p className="text-sm text-muted-foreground">
            Existencias reales por almacén con alerta cuando bajan del mínimo del producto
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Warehouse className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Esta sucursal todavía no tiene almacenes registrados.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard/inventory/warehouses">Ir a almacenes</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock por almacén</h1>
          <p className="text-sm text-muted-foreground">
            Existencias reales por almacén con alerta cuando bajan del mínimo del producto
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Select value={activeWarehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Almacén" />
            </SelectTrigger>
            <SelectContent>
              {(warehouses.data ?? []).map(warehouse => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setOnlyLow(current => !current)}
            className={`h-9 rounded-md border px-3 text-sm ${onlyLow ? 'border-destructive text-destructive' : 'border-input text-muted-foreground'}`}
          >
            <AlertTriangle className="mr-1 inline size-4" />
            Sólo bajo mínimo ({low.length})
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Líneas de stock</CardDescription>
            <CardTitle className="text-2xl">{rows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Bajo mínimo</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {low.length}
              {low.length > 0 && <AlertTriangle className="size-4 text-destructive" />}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Almacén</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Warehouse className="size-4" />
              {(warehouses.data ?? []).find(w => w.id === activeWarehouseId)?.name ?? '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <ListCard
        title="Existencias"
        description="Las líneas por lote se muestran separadas; el mínimo se compara por línea"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <ListTh>SKU</ListTh>
              <ListTh>Producto</ListTh>
              <ListTh hide="sm">Lote</ListTh>
              <ListTh align="right">Cantidad</ListTh>
              <ListTh align="right" hide="md">
                Costo prom.
              </ListTh>
              <ListTh align="right" hide="md">
                Valor
              </ListTh>
              <ListTh align="right" hide="md">
                Mínimo
              </ListTh>
              <ListTh>Alerta</ListTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.isLoading ? (
              <ListSkeletonRows cols={8} />
            ) : visible.length === 0 ? (
              <ListEmptyRow
                cols={8}
                message={
                  onlyLow ? 'Ningún producto bajo mínimo.' : 'Este almacén no tiene existencias.'
                }
                hint={
                  onlyLow
                    ? 'Desactiva el filtro para ver todas las líneas del almacén.'
                    : 'Registra una entrada de inventario para comenzar.'
                }
              />
            ) : (
              visible.map(row => (
                <TableRow key={row.id}>
                  <ListTd mono>{row.productSku ?? '—'}</ListTd>
                  <ListTd>{row.productName ?? row.productId.slice(0, 8)}</ListTd>
                  <ListTd muted className="text-xs" hide="sm">
                    {row.batchNumber ?? '—'}
                  </ListTd>
                  <ListTd numeric>{Number(row.quantity ?? 0)}</ListTd>
                  <ListTd numeric muted hide="md">
                    {row.averageCost ? Number(row.averageCost) : '—'}
                  </ListTd>
                  <ListTd numeric hide="md">
                    {row.totalValue ? Number(row.totalValue) : '—'}
                  </ListTd>
                  <ListTd numeric muted hide="md">
                    {row.minStock ? Number(row.minStock) : '—'}
                  </ListTd>
                  <ListTd>
                    {row.belowMinimum ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="mr-1 size-3" /> Bajo mínimo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </ListTd>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  );
}
