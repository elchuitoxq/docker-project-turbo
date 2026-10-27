'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar, Check, X, MoreHorizontal, Clock } from 'lucide-react';
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
import { useIncidents, useApproveIncident, useRejectIncident } from '../hooks';
import { formatDate } from '@/lib/utils';
import type { Incident, IncidentType } from '../api';

const TYPE_LABEL: Record<IncidentType, string> = {
  ABSENCE: 'Inasistencia',
  TARDINESS: 'Retardo',
  OVERTIME: 'Horas extra',
  VACATION: 'Vacaciones',
  SICK_LEAVE: 'Permiso médico',
  PERMIT: 'Permiso',
  BONUS: 'Bono',
};

const TYPE_VARIANT: Record<IncidentType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ABSENCE: 'destructive',
  TARDINESS: 'outline',
  OVERTIME: 'default',
  VACATION: 'secondary',
  SICK_LEAVE: 'outline',
  PERMIT: 'secondary',
  BONUS: 'default',
};

const STATUS_LABEL = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
} as const;

const STATUS_VARIANT = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
} as const;

export function IncidentsView() {
  const [type, setType] = React.useState<IncidentType | 'ALL'>('ALL');
  const [status, setStatus] = React.useState<string>('PENDING');
  const { data, isLoading } = useIncidents({
    type: type === 'ALL' ? undefined : type,
    status: status === 'ALL' ? undefined : status,
  });
  const approve = useApproveIncident();
  const reject = useRejectIncident();

  const incidents: Incident[] = data ?? [];
  const pendingCount = incidents.filter(i => i.status === 'PENDING').length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novedades</h1>
        <p className="text-sm text-muted-foreground">Permisos, inasistencias, horas extras</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-bold tabular-nums">{pendingCount}</p>
            </div>
            <Clock className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
        {(['VACATION', 'ABSENCE', 'OVERTIME'] as IncidentType[]).map(t => {
          const count = incidents.filter(i => i.type === t).length;
          return (
            <Card key={t}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{TYPE_LABEL[t]}</p>
                  <p className="text-2xl font-bold tabular-nums">{count}</p>
                </div>
                <AlertCircle className="size-5 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <Select value={type} onValueChange={v => setType(v as IncidentType | 'ALL')}>
            <SelectTrigger className="w-full sm:w-48">
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
          <Select value={status} onValueChange={setStatus}>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Cargando…'
              : `${incidents.length} resultado${incidents.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay novedades</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Detalle</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        {formatDate(i.date)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{i.employeeName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANT[i.type]}>{TYPE_LABEL[i.type]}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {i.days && `${i.days} días `}
                      {i.hours && `${i.hours} horas `}
                      {i.reason ?? ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {i.status === 'PENDING' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                approve.mutate(i.id, {
                                  onSuccess: () => toast.success('Novedad aprobada'),
                                })
                              }
                            >
                              <Check /> Aprobar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                reject.mutate(i.id, {
                                  onSuccess: () => toast.success('Novedad rechazada'),
                                })
                              }
                              className="text-destructive"
                            >
                              <X /> Rechazar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
