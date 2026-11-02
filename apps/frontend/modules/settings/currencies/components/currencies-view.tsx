'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Plus, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { useCurrencies } from '@/lib/currency';
import {
  isRateStale,
  MAX_RATE_AGE_DAYS,
  rateAgeInDays,
  REFERENCE_CURRENCY_CODE,
} from '@/lib/rates';
import { formatDay, formatMoney } from '@/lib/utils';
import { currenciesApi, type LatestRate } from '../api';

function ageLabel(date: string | null): string {
  const days = rateAgeInDays(date);
  if (days === null) return 'sin fecha';
  if (days === 0) return 'hoy';
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

function SourceBadge({ rate }: { rate: LatestRate }) {
  const manual = rate.source === 'MANUAL';
  return (
    <Badge variant={manual ? 'secondary' : 'outline'}>
      {manual ? 'Manual' : rate.source || 'BCV'}
    </Badge>
  );
}

/**
 * Monedas y tasas (`T-09-06`…`T-09-08`).
 *
 * La tasa es un dato contable: se muestra su fuente y su antigüedad, y el override manual exige
 * motivo porque queda en auditoría (`S-08` M9). Nunca se edita la tasa de un documento emitido.
 */
export function CurrenciesView() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSIONS.SETTINGS.CURRENCIES.MANAGE);

  const [overriding, setOverriding] = React.useState<LatestRate | null>(null);
  const [creating, setCreating] = React.useState(false);

  const currencies = useCurrencies();
  const rates = useQuery({
    queryKey: ['currencies', 'rates', 'latest'],
    queryFn: currenciesApi.listLatestRates,
  });

  const baseCurrency = (currencies.data ?? []).find(currency => currency.isBase);
  const baseCode = baseCurrency?.code ?? 'VES';
  // La moneda funcional no tiene tasa: la "tasa vigente" del sistema es la de la moneda de
  // referencia (USD), que es la que convierte a bolívares.
  const referenceCode =
    (rates.data ?? []).find(rate => rate.currencyCode === REFERENCE_CURRENCY_CODE)?.currencyCode ??
    REFERENCE_CURRENCY_CODE;
  const referenceRate = (rates.data ?? []).find(rate => rate.currencyCode === referenceCode);

  const history = useQuery({
    queryKey: ['currencies', 'rates', 'history', referenceCode],
    queryFn: () => currenciesApi.history(referenceCode, 10),
  });

  const refresh = useMutation({
    mutationFn: currenciesApi.refresh,
    onSuccess: async rate => {
      if (rate.status === 'manual-override') {
        toast.info(`El día tiene una tasa manual (${rate.rate}); no se sobrescribe con la de BCV`);
      } else if (rate.status === 'unchanged') {
        toast.success(`La tasa BCV del día ya estaba registrada: ${rate.rate}`);
      } else {
        toast.success(`Tasa BCV sincronizada: ${rate.rate}`);
      }
      await queryClient.invalidateQueries({ queryKey: ['currencies', 'rates'] });
      await queryClient.invalidateQueries({ queryKey: ['exchange-rate'] });
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo sincronizar la tasa BCV'),
  });

  const onCreate = async () => {
    setCreating(false);
    await queryClient.invalidateQueries({ queryKey: ['currencies'] });
  };

  const onOverridden = async () => {
    setOverriding(null);
    await queryClient.invalidateQueries({ queryKey: ['currencies', 'rates'] });
    await queryClient.invalidateQueries({ queryKey: ['exchange-rate'] });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monedas y tasas</h1>
          <p className="text-sm text-muted-foreground">
            Moneda funcional, tasa vigente e historial de cambios
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              <RefreshCw data-icon="inline-start" />
              {refresh.isPending ? 'Sincronizando…' : 'Sincronizar BCV'}
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus data-icon="inline-start" />
              Nueva moneda
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <CircleDollarSign className="size-3.5" /> Moneda funcional
            </CardDescription>
            <CardTitle className="text-2xl">{baseCode}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {baseCurrency?.name ?? 'Sin moneda base declarada'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Tasa vigente ({referenceCode})</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl tabular-nums">
              {rates.isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : referenceRate ? (
                formatMoney(referenceRate.rate, referenceCode)
              ) : (
                '—'
              )}
              {referenceRate && <SourceBadge rate={referenceRate} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>
              {referenceRate?.date ? formatDay(referenceRate.date) : 'Sin fecha'} ·{' '}
              {ageLabel(referenceRate?.date ?? null)}
            </span>
            {referenceRate && isRateStale(referenceRate.date) && (
              <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <TriangleAlert className="size-3.5" />
                Vencida: la emisión pide confirmación después de {MAX_RATE_AGE_DAYS} día
              </span>
            )}
            {!referenceRate && (
              <span>Sin tasa de {referenceCode}: se puede fijar a mano o sincronizar con BCV</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Monedas registradas</CardDescription>
            <CardTitle className="text-2xl">{(currencies.data ?? []).length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Todo documento guarda su moneda y la tasa aplicada al emitirse
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monedas</CardTitle>
          <CardDescription>Tasas vigentes por moneda</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {currencies.isLoading || rates.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Símbolo</TableHead>
                  <TableHead className="text-right">Tasa vigente</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(currencies.data ?? []).map(currency => {
                  const rate = (rates.data ?? []).find(r => r.currencyId === currency.id);
                  return (
                    <TableRow key={currency.id}>
                      <TableCell className="font-mono text-xs">
                        {currency.code}
                        {currency.isBase && (
                          <Badge variant="secondary" className="ml-2">
                            Funcional
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{currency.name}</TableCell>
                      <TableCell className="text-muted-foreground">{currency.symbol}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {currency.isBase
                          ? formatMoney(1, currency.code)
                          : rate
                            ? formatMoney(rate.rate, currency.code)
                            : '—'}
                      </TableCell>
                      <TableCell>{rate ? <SourceBadge rate={rate} /> : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rate?.date ? `${formatDay(rate.date)} · ${ageLabel(rate.date)}` : '—'}
                      </TableCell>
                      <TableCell>
                        {/* La moneda funcional vale 1 contra sí misma: no admite tasa manual. */}
                        {canManage && rate && (
                          <Button variant="ghost" size="sm" onClick={() => setOverriding(rate)}>
                            Tasa manual
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de {referenceCode}</CardTitle>
          <CardDescription>
            Cada cambio queda con su fuente, autor y motivo; los documentos emitidos conservan su
            tasa
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (history.data ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Todavía no hay tasas registradas para {referenceCode}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Tasa</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(history.data ?? []).map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs">{formatDay(entry.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(entry.rate, entry.currencyCode)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.source === 'MANUAL' ? 'secondary' : 'outline'}>
                        {entry.source === 'MANUAL' ? 'Manual' : entry.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.reason ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {overriding && (
        <RateOverrideDialog
          rate={overriding}
          onClose={() => setOverriding(null)}
          onDone={onOverridden}
        />
      )}
      {creating && <CreateCurrencyDialog onClose={() => setCreating(false)} onDone={onCreate} />}
    </div>
  );
}

function RateOverrideDialog({
  rate,
  onClose,
  onDone,
}: {
  rate: LatestRate;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [value, setValue] = React.useState(String(rate.rate));
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = React.useState('');
  const [accepted, setAccepted] = React.useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      currenciesApi.addRate({
        currencyCode: rate.currencyCode,
        rate: Number(value),
        reason,
        date,
      }),
    onSuccess: async () => {
      toast.success(`Tasa de ${rate.currencyCode} actualizada`);
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo fijar la tasa'),
  });

  const valid = Number(value) > 0 && reason.trim().length >= 5 && accepted;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tasa manual de {rate.currencyCode}</DialogTitle>
          <DialogDescription>
            Afecta a los documentos que se emitan a partir de ahora, nunca a los ya emitidos.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="rate-value">Tasa</FieldLabel>
            <Input
              id="rate-value"
              type="number"
              step="0.0001"
              min="0"
              value={value}
              onChange={event => setValue(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rate-date">Vigente desde</FieldLabel>
            <DatePicker
              id="rate-date"
              value={date}
              onChange={setDate}
              placeholder="Fecha de vigencia"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rate-reason">Motivo *</FieldLabel>
            <Input
              id="rate-reason"
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="BCV no publicó tasa por feriado bancario"
            />
          </Field>
          <Label className="flex items-start gap-2 font-normal">
            <Checkbox
              checked={accepted}
              onCheckedChange={checked => setAccepted(checked === true)}
              aria-label="Confirmar tasa manual"
            />
            <span className="text-xs leading-snug">
              Confirmo que esta tasa reemplaza la del día y que queda registrada en auditoría.
            </span>
          </Label>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            Fijar tasa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateCurrencyDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [symbol, setSymbol] = React.useState('');

  const mutation = useMutation({
    mutationFn: () =>
      currenciesApi.create({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        symbol: symbol.trim(),
      }),
    onSuccess: async () => {
      toast.success('Moneda creada');
      await onDone();
    },
    onError: error =>
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la moneda'),
  });

  const valid = code.trim().length === 3 && name.trim().length > 1 && symbol.trim().length > 0;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva moneda</DialogTitle>
          <DialogDescription>
            La moneda funcional no se cambia desde aquí: se define una sola vez.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="currency-code">Código ISO</FieldLabel>
            <Input
              id="currency-code"
              value={code}
              maxLength={3}
              onChange={event => setCode(event.target.value)}
              placeholder="EUR"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="currency-name">Nombre</FieldLabel>
            <Input
              id="currency-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Euro"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="currency-symbol">Símbolo</FieldLabel>
            <Input
              id="currency-symbol"
              value={symbol}
              onChange={event => setSymbol(event.target.value)}
              placeholder="€"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            Crear moneda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CurrencySelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (currencyId: string) => void;
  disabled?: boolean;
}) {
  const { data, isLoading } = useCurrencies();

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger>
        <SelectValue placeholder="Moneda" />
      </SelectTrigger>
      <SelectContent>
        {(data ?? []).map(currency => (
          <SelectItem key={currency.id} value={currency.id}>
            {currency.code} · {currency.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
