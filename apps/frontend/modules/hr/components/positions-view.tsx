'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase } from 'lucide-react';
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
import { usePositions } from '../hooks';
import { formatMoney } from '@/lib/utils';
import { useCurrencyIndex } from '@/lib/currency';
export function PositionsView() {
  const { data: positions = [], isLoading } = usePositions();
  const { baseCode } = useCurrencyIndex();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cargos</h1>
        <p className="text-sm text-muted-foreground">Cargos y posiciones de la organización</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Cargando…'
              : `${positions.length} cargo${positions.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : positions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay cargos</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="hidden md:table-cell">Descripción</TableHead>
                  <TableHead className="text-right">Rango salarial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map(position => (
                  <TableRow key={position.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="size-4 text-muted-foreground" />
                        <span className="font-medium">{position.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {position.description ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatMoney(Number(position.baseSalaryMin), baseCode)} –{' '}
                      {formatMoney(Number(position.baseSalaryMax), baseCode)}
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
