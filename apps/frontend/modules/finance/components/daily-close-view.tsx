'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { dailyCloseApi, type DailyClose } from '../api/daily-close';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_LABEL = {
  OPEN: 'Abierto',
  CLOSED: 'Cerrado',
  REVIEWED: 'Revisado',
} as const;

const STATUS_VARIANT = {
  OPEN: 'secondary',
  CLOSED: 'default',
  REVIEWED: 'outline',
} as const;

export function DailyCloseView() {
  const { data, isLoading } = useQuery({
    queryKey: ['daily-close'],
    queryFn: () => dailyCloseApi.list({}),
  });

  const closes: DailyClose[] = data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cierre diario</h1>
        <p className="text-sm text-muted-foreground">Cierre contable y de caja por día</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="size-4" /> Historial
          </CardTitle>
          <CardDescription>
            {isLoading ? 'Cargando…' : `${closes.length} cierre${closes.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : closes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay cierres registrados</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Egresos</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead>Cerrado por</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {closes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{formatDate(c.date)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status]}>
                        {c.status === 'OPEN' && <CheckCircle2 className="mr-1 size-3" />}
                        {c.status === 'CLOSED' && <Lock className="mr-1 size-3" />}
                        {c.status === 'REVIEWED' && <CheckCircle2 className="mr-1 size-3" />}
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {formatCurrency(Number(c.totalInflow))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {formatCurrency(Number(c.totalOutflow))}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        Number(c.netMovement) >= 0 ? 'text-emerald-600' : 'text-destructive'
                      }`}
                    >
                      {formatCurrency(Number(c.netMovement))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.closedBy ?? '—'}</TableCell>
                    <TableCell>
                      {c.status === 'OPEN' && (
                        <Button size="sm" variant="outline">
                          <Lock /> Cerrar
                        </Button>
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
