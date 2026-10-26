'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  Sliders,
  Check,
  X,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useMoves, useApproveMove, useCancelMove } from '../hooks/use-moves';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Move, MoveStatus, MoveType } from '../api/moves';

const TYPE_LABEL: Record<MoveType, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  TRANSFER: 'Transferencia',
  ADJUSTMENT: 'Ajuste',
};

const TYPE_VARIANT: Record<MoveType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  IN: 'default',
  OUT: 'destructive',
  TRANSFER: 'outline',
  ADJUSTMENT: 'secondary',
};

const TYPE_ICON: Record<MoveType, React.ComponentType<{ className?: string }>> = {
  IN: ArrowDown,
  OUT: ArrowUp,
  TRANSFER: ArrowLeftRight,
  ADJUSTMENT: Sliders,
};

const STATUS_LABEL: Record<MoveStatus, string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobado',
  CANCELLED: 'Cancelado',
};

const STATUS_VARIANT: Record<MoveStatus, 'default' | 'secondary' | 'destructive'> = {
  DRAFT: 'secondary',
  APPROVED: 'default',
  CANCELLED: 'destructive',
};

export function MovesView() {
  const t = useTranslations('common');
  const { hasPermission } = usePermission();
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<MoveType | 'ALL'>('ALL');
  const [status, setStatus] = React.useState<MoveStatus | 'ALL'>('ALL');

  const filters = React.useMemo(
    () => ({
      ...(type !== 'ALL' && { type }),
      ...(status !== 'ALL' && { status }),
    }),
    [type, status]
  );
  const { data, isLoading } = useMoves(filters);
  const approve = useApproveMove();
  const cancel = useCancelMove();

  const moves = (data?.data ?? []).filter(
    m =>
      !search ||
      m.code.toLowerCase().includes(search.toLowerCase()) ||
      (m.productName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (m.productSku ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos de inventario</h1>
        <p className="text-sm text-muted-foreground">Entradas, salidas, transferencias y ajustes</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        {(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'] as MoveType[]).map(t => {
          const Icon = TYPE_ICON[t];
          const count = (data?.data ?? []).filter(m => m.type === t).length;
          return (
            <Card key={t}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{TYPE_LABEL[t]}</p>
                  <p className="text-2xl font-bold tabular-nums">{count}</p>
                </div>
                <Icon className="size-5 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por código, producto o SKU…"
                className="pl-8"
              />
            </div>
            <Select value={type} onValueChange={v => setType(v as MoveType | 'ALL')}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={v => setStatus(v as MoveStatus | 'ALL')}>
              <SelectTrigger className="w-full sm:w-40">
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            {isLoading ? 'Cargando…' : `${moves.length} movimiento${moves.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : moves.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay movimientos</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="hidden md:table-cell">Almacén</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {moves.map(m => {
                  const Icon = TYPE_ICON[m.type];
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.code}</TableCell>
                      <TableCell className="text-xs">{formatDate(m.date)}</TableCell>
                      <TableCell>
                        <Badge variant={TYPE_VARIANT[m.type]} className="gap-1">
                          <Icon className="size-3" />
                          {TYPE_LABEL[m.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{m.productName ?? '—'}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {m.productSku}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {m.warehouseName}
                        {m.warehouseDestName && ` → ${m.warehouseDestName}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(m.quantity).toLocaleString('es-VE')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {m.status === 'DRAFT' &&
                              hasPermission(PERMISSIONS.INVENTORY.MOVES.APPROVE) && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    approve.mutate(m.id, {
                                      onSuccess: () => toast.success('Movimiento aprobado'),
                                      onError: () => toast.error('Error al aprobar'),
                                    })
                                  }
                                >
                                  <Check /> Aprobar
                                </DropdownMenuItem>
                              )}
                            {m.status !== 'CANCELLED' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  cancel.mutate(m.id, {
                                    onSuccess: () => toast.success('Movimiento cancelado'),
                                    onError: () => toast.error('Error al cancelar'),
                                  })
                                }
                                className="text-destructive"
                              >
                                <X /> Cancelar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
