'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Coins, Check, X, MoreHorizontal, FileText, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePayrolls, useApprovePayroll, usePayPayroll } from '../hooks';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PayrollRun } from '../api';

const STATUS_LABEL = {
  DRAFT: 'Borrador',
  CALCULATED: 'Calculada',
  APPROVED: 'Aprobada',
  PAID: 'Pagada',
  VOID: 'Anulada',
} as const;

const STATUS_VARIANT = {
  DRAFT: 'secondary',
  CALCULATED: 'outline',
  APPROVED: 'default',
  PAID: 'default',
  VOID: 'destructive',
} as const;

export function PayrollView() {
  const [status, setStatus] = React.useState<string>('ALL');
  const { data, isLoading } = usePayrolls({ ...(status !== 'ALL' && { status }) });
  const approve = useApprovePayroll();
  const pay = usePayPayroll();

  const runs: PayrollRun[] = data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nómina</h1>
        <p className="text-sm text-muted-foreground">
          Procesamiento de nómina, IVSS, FAOV, prestaciones
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Períodos</p>
              <p className="text-2xl font-bold tabular-nums">{runs.length}</p>
            </div>
            <Calendar className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Total bruto</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(runs.reduce((a, r) => a + Number(r.totalGross), 0))}
              </p>
            </div>
            <Coins className="size-5 text-emerald-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Total neto</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(runs.reduce((a, r) => a + Number(r.totalNet), 0))}
              </p>
            </div>
            <Coins className="size-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button>
            <FileText /> Nuevo período
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Períodos de nómina</CardTitle>
          <CardDescription>
            {isLoading ? 'Cargando…' : `${runs.length} resultado${runs.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay nóminas procesadas
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Empleados</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Deducciones</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="text-xs">
                      {formatDate(r.periodFrom)} – {formatDate(r.periodTo)}
                    </TableCell>
                    <TableCell className="tabular-nums">{r.employeesCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(r.totalGross))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(Number(r.totalDeductions))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(Number(r.totalNet))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {r.status === 'CALCULATED' && (
                            <DropdownMenuItem
                              onClick={() =>
                                approve.mutate(r.id, {
                                  onSuccess: () => toast.success('Nómina aprobada'),
                                })
                              }
                            >
                              <Check /> Aprobar
                            </DropdownMenuItem>
                          )}
                          {r.status === 'APPROVED' && (
                            <DropdownMenuItem
                              onClick={() =>
                                pay.mutate(r.id, {
                                  onSuccess: () => toast.success('Pago registrado'),
                                })
                              }
                            >
                              <Coins /> Registrar pago
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
