'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Wallet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { payablesApi, type Payable, type PayableStatus } from '../api/payables';
import { treasuryApi } from '../api/treasury';
import { useBranchStore } from '@/stores/use-branch-store';
import { formatCurrency, formatDay } from '@/lib/utils';

const STATUS_LABEL: Record<PayableStatus, string> = {
  PENDING: 'Pendiente',
  PARTIAL: 'Abonada',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
};

const STATUS_VARIANT: Record<PayableStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  PARTIAL: 'outline',
  PAID: 'default',
  OVERDUE: 'destructive',
};

export function PayablesView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<'ALL' | PayableStatus>('ALL');
  const [paying, setPaying] = React.useState<Payable | null>(null);

  const payables = useQuery({
    queryKey: ['payables', { status }],
    queryFn: () => payablesApi.list(status === 'ALL' ? {} : { status }),
  });

  const aging = useQuery({ queryKey: ['payables', 'aging'], queryFn: () => payablesApi.aging() });

  const rows = React.useMemo(() => {
    const list = payables.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      row =>
        row.code.toLowerCase().includes(q) ||
        row.partnerName.toLowerCase().includes(q) ||
        (row.supplierInvoiceNumber ?? '').toLowerCase().includes(q)
    );
  }, [payables.data, search]);

  const totalBalance = rows.reduce((sum, row) => sum + row.balance, 0);
  const totalOverdue = rows.reduce(
    (sum, row) => (row.status === 'OVERDUE' ? sum + row.balance : sum),
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas por pagar</h1>
        <p className="text-sm text-muted-foreground">
          Antigüedad de saldos por proveedor, con retenciones y notas de crédito descontadas
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Saldo total</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalBalance)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Vencido</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {formatCurrency(totalOverdue)}
              {totalOverdue > 0 && <AlertTriangle className="text-destructive" />}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Por vencer</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(aging.data?.buckets.find(b => b.bucket === 'CURRENT')?.total ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Más de 90 días</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(aging.data?.buckets.find(b => b.bucket === 'D90_PLUS')?.total ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Antigüedad de saldos</CardTitle>
          <CardDescription>
            {aging.data
              ? `Al ${formatDay(aging.data.asOf)} · ${aging.data.byPartner.length} proveedores`
              : 'Calculando…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aging.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-5">
              {(aging.data?.buckets ?? []).map(bucket => (
                <div key={bucket.bucket} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{bucket.label}</p>
                  <p className="text-lg font-medium">{formatCurrency(bucket.total)}</p>
                  <p className="text-xs text-muted-foreground">{bucket.invoices} facturas</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar por factura o proveedor…"
                className="pl-8"
              />
            </div>
            <Select
              value={status}
              onValueChange={value => setStatus(value as 'ALL' | PayableStatus)}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="PARTIAL">Abonada</SelectItem>
                <SelectItem value="OVERDUE">Vencida</SelectItem>
                <SelectItem value="PAID">Pagada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {payables.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay cuentas por pagar con estos filtros.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Retenido</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.invoiceId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.code}</span>
                        {row.supplierInvoiceNumber && (
                          <span className="text-xs text-muted-foreground">
                            Prov. {row.supplierInvoiceNumber}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{row.partnerName}</span>
                        <span className="text-xs text-muted-foreground">{row.partnerTaxId}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDay(row.issueDate)}</TableCell>
                    <TableCell>
                      {row.dueDate ? (
                        <div className="flex flex-col">
                          <span>{formatDay(row.dueDate)}</span>
                          {row.daysOverdue > 0 && (
                            <span className="text-xs text-destructive">
                              {row.daysOverdue} días vencida
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sin vencimiento</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.total, row.currencyCode === 'VES' ? 'VES' : 'USD')}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.retained)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.paid)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.balance)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={row.balance <= 0}
                        onClick={() => setPaying(row)}
                      >
                        <Wallet data-icon="inline-start" />
                        Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {paying && (
        <PaymentDialog
          payable={paying}
          onClose={() => setPaying(null)}
          onDone={async () => {
            setPaying(null);
            await queryClient.invalidateQueries({ queryKey: ['payables'] });
          }}
        />
      )}
    </div>
  );
}

function PaymentDialog({
  payable,
  onClose,
  onDone,
}: {
  payable: Payable;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [amount, setAmount] = React.useState(String(payable.balance));
  const [methodId, setMethodId] = React.useState('');
  const [reference, setReference] = React.useState('');
  const currentBranchId = useBranchStore(state => state.currentBranchId);

  const methods = useQuery({ queryKey: ['payment-methods'], queryFn: treasuryApi.listMethods });

  const pay = useMutation({
    mutationFn: () =>
      treasuryApi.createPayment({
        partnerId: payable.partnerId,
        ...(currentBranchId ? { branchId: currentBranchId } : {}),
        methodId,
        type: 'EXPENSE',
        amount: Number(amount),
        currencyId: payable.currencyId,
        exchangeRate: 1,
        reference,
        // El backend valida la asignación contra el saldo real de la factura (regla 4 de `S-03`).
        allocations: [{ invoiceId: payable.invoiceId, amount: Number(amount) }],
      }),
    onSuccess: async () => {
      toast.success('Pago registrado');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el pago'),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar {payable.code}</DialogTitle>
          <DialogDescription>
            Saldo {formatCurrency(payable.balance)} · {payable.partnerName}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pay-method">Método de pago</FieldLabel>
            <Select value={methodId} onValueChange={setMethodId}>
              <SelectTrigger id="pay-method">
                <SelectValue placeholder="Selecciona un método" />
              </SelectTrigger>
              <SelectContent>
                {(methods.data ?? []).map(method => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-amount">Monto</FieldLabel>
            <Input
              id="pay-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-reference">Referencia</FieldLabel>
            <Input
              id="pay-reference"
              value={reference}
              onChange={event => setReference(event.target.value)}
              placeholder="Número de transferencia o cheque"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => pay.mutate()}
            disabled={!methodId || !amount || Number(amount) <= 0 || pay.isPending}
          >
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
