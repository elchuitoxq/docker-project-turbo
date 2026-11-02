'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { treasuryApi } from '../api/treasury';
import { useBranchStore } from '@/stores/use-branch-store';
import { formatDual, formatMoney } from '@/lib/utils';
import { BASE_CURRENCY_CODE, findRate, isRateStale, useLatestRates } from '@/lib/rates';
import { useCurrencyIndex } from '@/lib/currency';
import { StaleRateGate } from '@/components/finance/stale-rate-gate';

export type PaymentDialogTarget = {
  invoiceId: string;
  /** Código del documento que se está cobrando/pagando, para los textos del diálogo. */
  code: string;
  partnerId: string;
  partnerName?: string | null;
  /** Saldo abierto del documento, en la moneda del documento. */
  balance: number;
  currencyId: string;
  currencyCode: string;
  /** Tasa congelada del documento: convierte el saldo a la moneda de la cuenta. */
  invoiceRate: number;
};

type Props = PaymentDialogTarget & {
  /** `INCOME` cobra al cliente (CxC); `EXPENSE` paga al proveedor (CxP). */
  direction: 'INCOME' | 'EXPENSE';
  onClose: () => void;
  onDone: () => void | Promise<void>;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Registro de cobro o pago imputado a una factura (`S-16` M-21, `S-18`).
 *
 * La **cuenta manda la moneda**: se elige primero la cuenta y de ella salen la moneda del pago y la
 * tasa del día. Un cobro en divisa no puede entrar a una cuenta en bolívares, porque el saldo de la
 * cuenta dejaría de conciliar. La factura puede estar en otra moneda: el importe se imputa en la
 * moneda del documento y el backend calcula la diferencia cambiaria.
 */
export function PaymentDialog({
  invoiceId,
  code,
  partnerId,
  partnerName,
  balance,
  currencyId,
  currencyCode,
  invoiceRate,
  direction,
  onClose,
  onDone,
}: Props) {
  const { codeOf } = useCurrencyIndex();
  const [accountId, setAccountId] = React.useState('');
  const [methodId, setMethodId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [rateConfirmed, setRateConfirmed] = React.useState(false);
  const currentBranchId = useBranchStore(state => state.currentBranchId);
  const queryClient = useQueryClient();

  const methods = useQuery({ queryKey: ['payment-methods'], queryFn: treasuryApi.listMethods });
  const accounts = useQuery({ queryKey: ['bank-accounts'], queryFn: treasuryApi.listAccounts });
  const rates = useLatestRates();

  const account = (accounts.data ?? []).find(item => item.id === accountId);
  const method = (methods.data ?? []).find(item => item.id === methodId);
  const paymentCurrencyId = account?.currencyId ?? currencyId;
  const paymentCurrencyCode = codeOf(paymentCurrencyId);
  const isBase = paymentCurrencyCode === BASE_CURRENCY_CODE;

  const paymentRateEntry = findRate(rates.data, paymentCurrencyCode);
  const paymentRate = isBase ? 1 : (paymentRateEntry?.rate ?? 0);
  const rateReady = isBase || paymentRate > 0;
  const rateStale = !isBase && (!paymentRateEntry || isRateStale(paymentRateEntry.date));
  const sameCurrency = paymentCurrencyId === currencyId;

  // Saldo del documento convertido a la moneda de la cuenta: es el importe con el que se cobra/paga.
  // `invoiceRate` es la tasa congelada de la factura; `paymentRate`, la del día de la cuenta.
  const balanceInPaymentCurrency =
    sameCurrency || !paymentRate ? balance : round2((balance * invoiceRate) / paymentRate);

  // El importe arranca en el saldo completo al elegir cuenta: se calcula en el manejador y no en un
  // efecto para no encadenar renders.
  const suggestedAmount = React.useCallback(
    (nextCurrencyId: string): string => {
      if (nextCurrencyId === currencyId) return String(balance);

      const nextCode = codeOf(nextCurrencyId);
      const nextRate =
        nextCode === BASE_CURRENCY_CODE ? 1 : (findRate(rates.data, nextCode)?.rate ?? 0);

      return nextRate > 0 ? String(round2((balance * invoiceRate) / nextRate)) : '';
    },
    [balance, currencyId, codeOf, rates.data, invoiceRate]
  );

  const handleAccountChange = (nextAccountId: string) => {
    setAccountId(nextAccountId);

    const next = (accounts.data ?? []).find(item => item.id === nextAccountId);
    if (next) setAmount(suggestedAmount(next.currencyId));
  };

  const isCollection = direction === 'INCOME';
  const title = isCollection ? `Cobrar ${code}` : `Pagar ${code}`;
  const submitLabel = isCollection ? 'Registrar cobro' : 'Registrar pago';

  const trimmedReference = reference.trim();
  // El método puede exigir referencia (`requiresReference`, `T-05-01`). El backend la rechaza igual,
  // pero el formulario no debe dejar llegar al servidor con el campo vacío.
  const referenceRequired = Boolean(method?.requiresReference);
  const referenceMissing = referenceRequired && trimmedReference.length === 0;

  const pay = useMutation({
    mutationFn: () =>
      treasuryApi.createPayment({
        partnerId,
        ...(currentBranchId ? { branchId: currentBranchId } : {}),
        methodId,
        bankAccountId: accountId,
        type: direction,
        amount: Number(amount),
        currencyId: paymentCurrencyId,
        exchangeRate: paymentRate,
        // Vacío es «sin referencia»: se omite para no guardar una cadena en blanco.
        ...(trimmedReference ? { reference: trimmedReference } : {}),
        // El backend imputa en la moneda de la factura y valida contra su saldo real.
        allocations: [{ invoiceId, amount: Number(amount) }],
      }),
    onSuccess: async () => {
      toast.success(isCollection ? 'Cobro registrado' : 'Pago registrado');
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['payables'] });
      await queryClient.invalidateQueries({ queryKey: ['treasury'] });
      await queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      await onDone();
    },
    onError: error =>
      toast.error(
        error instanceof Error
          ? error.message
          : isCollection
            ? 'No se pudo registrar el cobro'
            : 'No se pudo registrar el pago'
      ),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Saldo {formatMoney(balance, currencyCode)}
            {!sameCurrency && account
              ? ` · equivale a ${formatMoney(balanceInPaymentCurrency, paymentCurrencyCode)}`
              : ''}
            {partnerName ? ` · ${partnerName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pay-account">
              Cuenta de {isCollection ? 'cobro' : 'pago'}
            </FieldLabel>
            <Select value={accountId} onValueChange={handleAccountChange}>
              <SelectTrigger id="pay-account">
                <SelectValue placeholder="Selecciona la cuenta" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data ?? [])
                  .filter(item => item.isActive !== false)
                  .map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {`${item.bankName ?? 'Cuenta'} · ${item.accountNumber} (${codeOf(item.currencyId)})`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              La moneda del {isCollection ? 'cobro' : 'pago'} es la de la cuenta: no se mezclan
              monedas en un mismo saldo.
            </p>
          </Field>
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
            <FieldLabel htmlFor="pay-amount">Monto ({paymentCurrencyCode})</FieldLabel>
            <Input
              id="pay-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={event => setAmount(event.target.value)}
              disabled={!account}
            />
            <p className="text-xs text-muted-foreground" data-testid="pay-dual">
              {formatDual(Number(amount) || 0, paymentCurrencyCode, paymentRate || 1)}
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-reference">
              Referencia{referenceRequired ? ' *' : ''}
            </FieldLabel>
            <Input
              id="pay-reference"
              value={reference}
              onChange={event => setReference(event.target.value)}
              placeholder="Número de transferencia o cheque"
              maxLength={120}
              aria-invalid={referenceMissing}
            />
            <p className="text-xs text-muted-foreground">
              {referenceRequired
                ? 'Este método exige el número de referencia de la transacción.'
                : 'Opcional para este método.'}{' '}
              No puede repetirse: se valida contra todos los pagos registrados.
            </p>
          </Field>
        </FieldGroup>

        {!isBase && (
          <StaleRateGate
            rate={paymentRateEntry}
            currencyCode={paymentCurrencyCode}
            confirmed={rateConfirmed}
            onConfirmedChange={setRateConfirmed}
            documentLabel={`${isCollection ? 'el cobro' : 'el pago'} de ${code}`}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => pay.mutate()}
            disabled={
              !accountId ||
              !methodId ||
              !amount ||
              Number(amount) <= 0 ||
              referenceMissing ||
              !rateReady ||
              (rateStale && !rateConfirmed) ||
              pay.isPending
            }
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
