'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../api/invoices';
import type { Invoice, InvoiceFilters } from '../api/invoices';

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (filters: InvoiceFilters) => ['invoices', 'list', filters] as const,
  detail: (id: string) => ['invoices', 'detail', id] as const,
  fiscal: (id: string) => ['invoices', 'fiscal', id] as const,
  stats: ['invoices', 'stats'] as const,
};

export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => invoicesApi.list(filters),
  });
}

export function useInvoiceStats() {
  return useQuery({
    queryKey: invoiceKeys.stats,
    queryFn: () => invoicesApi.stats(),
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ''),
    queryFn: () => invoicesApi.get(id as string),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Invoice>) => invoicesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Invoice>) => invoicesApi.update(id, data),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.setQueryData(invoiceKeys.detail(id), data);
    },
  });
}

export function usePostInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.post(id),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.setQueryData(invoiceKeys.detail(data.id), data);
    },
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => invoicesApi.void(id, reason),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.setQueryData(invoiceKeys.detail(data.id), data);
    },
  });
}
