'use client';

import * as React from 'react';
import Link from 'next/link';
import { CreditCard, FileMinus, FileSpreadsheet, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDay, formatMoney } from '@/lib/utils';
import { statusLabel, statusVariant } from '../status';
import type { DocumentCreditNote, DocumentPayment, DocumentRetention } from '../types';

/**
 * Documentos relacionados con la factura (`S-10`): pedido de origen, pagos aplicados, notas de crédito
 * y retenciones. Cada bloque aparece sólo si tiene filas.
 */
export function DocumentRelated({
  orderHref,
  orderCode,
  payments,
  creditNotes,
  retentions,
  currencyCode,
}: {
  orderHref?: string | null;
  orderCode?: string | null;
  payments?: DocumentPayment[];
  creditNotes?: DocumentCreditNote[];
  retentions?: DocumentRetention[];
  currencyCode: string;
}) {
  const hasPayments = (payments ?? []).length > 0;
  const hasNotes = (creditNotes ?? []).length > 0;
  const hasRetentions = (retentions ?? []).length > 0;
  if (!orderHref && !hasPayments && !hasNotes && !hasRetentions) return null;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {orderHref && orderCode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4" /> Pedido de origen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={orderHref} className="font-mono text-sm hover:underline">
              {orderCode}
            </Link>
          </CardContent>
        </Card>
      )}

      {hasPayments && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4" /> Pagos aplicados
            </CardTitle>
            <CardDescription>Cada pago con su propia moneda y tasa</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pago</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments!.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <span className="block font-mono text-xs">{payment.code}</span>
                      {payment.reference && (
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {payment.reference}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {payment.date ? formatDay(payment.date.slice(0, 10)) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(payment.amount, payment.currencyCode ?? currencyCode)}
                      {payment.exchangeRate && payment.exchangeRate !== 1 && (
                        <span className="block text-xs text-muted-foreground">
                          Tasa {Number(payment.exchangeRate)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(payment.status)}>
                        {statusLabel(payment.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {hasNotes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileMinus className="size-4" /> Notas de crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes!.map(note => (
                  <TableRow key={note.id}>
                    <TableCell className="font-mono text-xs">{note.code}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(note.total, currencyCode)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(note.status)}>{statusLabel(note.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {hasRetentions && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="size-4" /> Retenciones
            </CardTitle>
            <CardDescription>Comprobantes emitidos sobre esta compra</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Retenido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retentions!.map(retention => (
                  <TableRow key={retention.id}>
                    <TableCell className="font-mono text-xs">
                      {retention.code}
                      {retention.voucherNumber && retention.voucherNumber !== retention.code
                        ? ` · ${retention.voucherNumber}`
                        : ''}
                    </TableCell>
                    <TableCell>{retention.type}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(retention.totalRetained, currencyCode)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
