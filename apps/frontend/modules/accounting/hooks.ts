'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  accountingApi,
  type CreateAccountBody,
  type CreateEntryBody,
  type EntrySourceType,
  type UpdateAccountBody,
} from './api';

export const accountingKeys = {
  accounts: ['accounting', 'accounts'] as const,
  entries: (filters: Record<string, string | undefined>) =>
    ['accounting', 'entries', filters] as const,
  entry: (id: string) => ['accounting', 'entry', id] as const,
  periods: (year: number) => ['accounting', 'periods', year] as const,
  trialBalance: (from?: string, to?: string) =>
    ['accounting', 'trial-balance', from ?? '', to ?? ''] as const,
  balanceSheet: (date?: string) => ['accounting', 'balance-sheet', date ?? ''] as const,
  incomeStatement: (from?: string, to?: string) =>
    ['accounting', 'income-statement', from ?? '', to ?? ''] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: accountingKeys.accounts,
    queryFn: () => accountingApi.listAccounts(),
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAccountBody) => accountingApi.createAccount(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountingKeys.accounts }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAccountBody }) =>
      accountingApi.updateAccount(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountingKeys.accounts }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountingApi.deleteAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountingKeys.accounts }),
  });
}

export function useEntries(
  filters: {
    from?: string;
    to?: string;
    sourceType?: EntrySourceType;
  } = {}
) {
  return useQuery({
    queryKey: accountingKeys.entries(filters as Record<string, string | undefined>),
    queryFn: () => accountingApi.listEntries(filters),
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEntryBody) => accountingApi.createEntry(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting', 'entries'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'periods'] });
    },
  });
}

export function usePostEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountingApi.postEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting', 'entries'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'trial-balance'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'balance-sheet'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'income-statement'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'periods'] });
    },
  });
}

export function usePeriods(year: number) {
  return useQuery({
    queryKey: accountingKeys.periods(year),
    queryFn: () => accountingApi.listPeriods(year),
  });
}

export function useClosePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountingApi.closePeriod(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting', 'periods'] }),
  });
}

export function useReopenPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      accountingApi.reopenPeriod(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting', 'periods'] }),
  });
}

export function useTrialBalance(from?: string, to?: string) {
  return useQuery({
    queryKey: accountingKeys.trialBalance(from, to),
    queryFn: () => accountingApi.trialBalance(from, to),
  });
}

export function useBalanceSheet(date?: string) {
  return useQuery({
    queryKey: accountingKeys.balanceSheet(date),
    queryFn: () => accountingApi.balanceSheet(date),
  });
}

export function useIncomeStatement(from?: string, to?: string) {
  return useQuery({
    queryKey: accountingKeys.incomeStatement(from, to),
    queryFn: () => accountingApi.incomeStatement(from, to),
  });
}
