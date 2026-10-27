'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Landmark,
  Wallet,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
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
import { treasuryApi, type Payment } from '../api/treasury';
import { useVoidInvoice } from '../hooks/use-invoices';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_LABEL = {
  PENDING: 'Pendiente',
  POSTED: 'Registrado',
  VOID: 'Anulado',
} as const;

const STATUS_VARIANT = {
  PENDING: 'secondary',
  POSTED: 'default',
  VOID: 'destructive',
} as const;

export function TreasuryView() {
  const t = useTranslations('common');
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [status, setStatus] = React.useState<string>('ALL');

  const { data: accounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => treasuryApi.listAccounts(),
  });
  const { data: payments, isLoading } = useQuery({
    queryKey: ['treasury', 'payments', { type, status }],
    queryFn: () =>
      treasuryApi.listPayments({
        ...(type !== 'ALL' && { type }),
        ...(status !== 'ALL' && { status }),
      }),
  });
  const voidPay = useVoidInvoice();

  const totalBalance = (accounts ?? []).reduce((acc, a) => acc + Number(a.balance ?? 0), 0);
  const totalInflow = (payments?.data ?? [])
    .filter(p => p.type === 'INCOME' && p.status === 'POSTED')
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const totalOutflow = (payments?.data ?? [])
    .filter(p => p.type === 'EXPENSE' && p.status === 'POSTED')
    .reduce((acc, p) => acc + Number(p.amount), 0);

  const filtered = (payments?.data ?? []).filter(
    p =>
      !search ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      (p.partnerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tesorería</h1>
        <p className="text-sm text-muted-foreground">Cuentas bancarias, pagos y movimientos</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Saldo total</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalBalance)}</p>
            </div>
            <Wallet className="size-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Ingresos</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-600">
                {formatCurrency(totalInflow)}
              </p>
            </div>
            <ArrowDown className="size-5 text-emerald-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Egresos</p>
              <p className="text-2xl font-bold tabular-nums text-destructive">
                {formatCurrency(totalOutflow)}
              </p>
            </div>
            <ArrowUp className="size-5 text-destructive" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-4" /> Cuentas bancarias
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(accounts ?? []).map(a => (
            <div key={a.id} className="rounded-md border p-3">
              <p className="text-sm font-medium">{a.bankName}</p>
              <p className="font-mono text-xs text-muted-foreground">{a.accountNumber}</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="outline">{a.currencyCode}</Badge>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(Number(a.balance ?? 0))}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar pagos…"
                className="pl-8"
              />
            </div>
            <Select value={type} onValueChange={v => setType(v as 'ALL' | 'INCOME' | 'EXPENSE')}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="INCOME">Ingresos</SelectItem>
                <SelectItem value="EXPENSE">Egresos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
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
              <Plus /> Nuevo pago
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pagos</CardTitle>
          <CardDescription>
            {isLoading ? 'Cargando…' : `${filtered.length} pago${filtered.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay pagos</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: Payment) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="text-xs">{formatDate(p.date)}</TableCell>
                    <TableCell>
                      <Badge variant={p.type === 'INCOME' ? 'default' : 'secondary'}>
                        {p.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.partnerName ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.reference ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${
                        p.type === 'INCOME' ? 'text-emerald-600' : 'text-destructive'
                      }`}
                    >
                      {p.type === 'INCOME' ? '+' : '-'}
                      {formatCurrency(Number(p.amount), p.currencyCode === 'VES' ? 'VES' : 'USD')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {p.status !== 'VOID' && (
                            <DropdownMenuItem
                              onClick={() => {
                                if (window.confirm(`¿Anular el pago ${p.code}?`)) {
                                  voidPay.mutate(
                                    { id: p.id, reason: 'Anulado desde tesorería' },
                                    {
                                      onSuccess: () => toast.success('Pago anulado'),
                                      onError: () => toast.error('Error al anular'),
                                    }
                                  );
                                }
                              }}
                              className="text-destructive"
                            >
                              <X /> Anular
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
