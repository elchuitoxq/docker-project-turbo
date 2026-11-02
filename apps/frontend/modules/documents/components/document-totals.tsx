'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDual, formatMoney } from '@/lib/utils';
import type { DocumentSettlement } from '../types';

/**
 * Totales del documento (`S-10`).
 *
 * La moneda del documento manda el símbolo y el equivalente en moneda funcional usa **la tasa del
 * documento**, no la del día. El saldo lo calcula el backend (`settlement`), la UI no lo recalcula.
 */
export function DocumentTotals({
  totalBase,
  totalTax,
  totalIgtf,
  total,
  currencyCode,
  exchangeRate,
  settlement,
  issueLabel = 'Total',
  showBaseEquivalent = true,
}: {
  totalBase: number;
  totalTax: number;
  totalIgtf: number;
  total: number;
  currencyCode: string;
  exchangeRate: number;
  settlement?: DocumentSettlement;
  issueLabel?: string;
  /**
   * `false` para documentos que no son fiscales (pedidos): el total se muestra sólo en la moneda
   * del documento, sin equivalente en moneda funcional.
   */
  showBaseEquivalent?: boolean;
}) {
  const rate = Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 1;
  const formatTotal = (value: number) =>
    showBaseEquivalent ? formatDual(value, currencyCode, rate) : formatMoney(value, currencyCode);
  const rows: { label: string; value: number }[] = [
    { label: 'Base imponible', value: totalBase },
    { label: 'IVA', value: totalTax },
  ];
  if (totalIgtf > 0) rows.push({ label: 'IGTF', value: totalIgtf });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{issueLabel}</CardTitle>
        {showBaseEquivalent && (
          <CardDescription>
            Tasa del documento {rate.toFixed(2)}
            {currencyCode ? ` · ${currencyCode}` : ''}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="tabular-nums">{formatMoney(row.value, currencyCode)}</span>
          </div>
        ))}

        <Separator />

        <div className="flex items-center justify-between gap-4 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatTotal(total)}</span>
        </div>

        {settlement && (
          <>
            <Separator />
            {settlement.paid > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Pagado</span>
                <span className="tabular-nums">{formatMoney(settlement.paid, currencyCode)}</span>
              </div>
            )}
            {settlement.credited > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Notas de crédito</span>
                <span className="tabular-nums">
                  {formatMoney(settlement.credited, currencyCode)}
                </span>
              </div>
            )}
            {settlement.retained > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Retenido</span>
                <span className="tabular-nums">
                  {formatMoney(settlement.retained, currencyCode)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 font-semibold">
              <span>Saldo</span>
              <span className="tabular-nums">{formatTotal(settlement.balance)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
