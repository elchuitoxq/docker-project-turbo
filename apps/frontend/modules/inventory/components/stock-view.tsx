'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Package, Warehouse } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api/client';
import { useWarehouses } from '../hooks/use-warehouses';

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

  const warehouses = useWarehouses();

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4" /> Existencias
          </CardTitle>
          <CardDescription>
            Las líneas por lote se muestran separadas; el mínimo se compara por línea
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {stock.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {onlyLow
                ? 'Ningún producto está por debajo de su mínimo.'
                : 'Este almacén no tiene existencias registradas.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Alerta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.productSku ?? '—'}</TableCell>
                    <TableCell>{row.productName ?? row.productId.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.batchNumber ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(row.quantity ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.minStock ? Number(row.minStock) : '—'}
                    </TableCell>
                    <TableCell>
                      {row.belowMinimum ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 size-3" /> Bajo mínimo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
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
