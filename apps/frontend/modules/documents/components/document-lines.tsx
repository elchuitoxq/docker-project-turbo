'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney } from '@/lib/utils';
import type { DocumentLine } from '../types';

/**
 * Líneas del documento en su moneda (`S-10`).
 *
 * El SKU y el nombre los resuelve el backend en el detalle: la ficha nunca muestra un UUID de producto.
 */
export function DocumentLines({
  items,
  currencyCode,
  quantityLabel = 'Cant.',
}: {
  items: DocumentLine[];
  currencyCode: string;
  quantityLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Líneas</CardTitle>
        <CardDescription>
          {items.length} {items.length === 1 ? 'línea' : 'líneas'} en {currencyCode}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            El documento no tiene líneas.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">{quantityLabel}</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Impuesto</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.productSku ?? '—'}</TableCell>
                  <TableCell className="font-medium">{item.productName ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(item.price, currencyCode)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                    {item.taxRate === null || item.taxRate === undefined
                      ? '—'
                      : `${Number(item.taxRate).toFixed(2)}%`}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(item.total, currencyCode)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
