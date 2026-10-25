'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Search, MoreHorizontal, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useEmployees, useDepartments } from '../hooks';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Employee, EmployeeStatus } from '../api';

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  SUSPENDED: 'Suspendido',
  TERMINATED: 'Egresado',
};

const STATUS_VARIANT: Record<EmployeeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  SUSPENDED: 'outline',
  TERMINATED: 'destructive',
};

export function EmployeesView() {
  const { hasPermission } = usePermission();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<EmployeeStatus | 'ALL'>('ALL');
  const [departmentId, setDepartmentId] = React.useState<string>('ALL');

  const { data, isLoading } = useEmployees({
    ...(status !== 'ALL' && { status }),
    ...(departmentId !== 'ALL' && { departmentId }),
  });
  const { data: departments = [] } = useDepartments();

  const filtered = (data?.data ?? []).filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q) ||
      e.nationalId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} empleado{filtered.length === 1 ? '' : 's'}
          </p>
        </div>
        {hasPermission(PERMISSIONS.HR.EMPLOYEES.CREATE) && (
          <Button>
            <Plus /> Nuevo empleado
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, cédula o código…"
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as EmployeeStatus | 'ALL')}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los departamentos</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
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
          <CardDescription>{isLoading ? 'Cargando…' : `${filtered.length} resultados`}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay empleados</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead className="hidden md:table-cell">Departamento</TableHead>
                  <TableHead className="hidden lg:table-cell">Cargo</TableHead>
                  <TableHead className="hidden md:table-cell">Ingreso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Salario</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e: Employee) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/hr/employees/${e.id}`} className="hover:underline">
                        {e.firstName} {e.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.nationalId}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {e.departmentName ?? '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {e.positionName ?? '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {formatDate(e.hireDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right tabular-nums">
                      {formatCurrency(Number(e.salary), e.salaryCurrencyCode === 'VES' ? 'VES' : 'USD')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/hr/employees/${e.id}`}>
                              <UsersIcon /> Ver detalle
                            </Link>
                          </DropdownMenuItem>
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
