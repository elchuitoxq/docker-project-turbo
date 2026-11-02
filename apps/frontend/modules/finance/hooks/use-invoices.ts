'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../api/invoices';
import type {
  CreateInvoicePayload,
  Invoice,
  InvoiceFilters,
  UpdateInvoicePayload,
} from '../api/invoices';

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (filters: InvoiceFilters) => ['invoices', 'list', filters] as const,
  detail: (id: string) => ['invoices', 'detail', id] as const,
  /** Ficha del documento (`S-10`): cabecera + líneas + pagos + saldo. Cache distinto de `detail`. */
  document: (id: string) => ['invoices', 'document', id] as const,
  fiscal: (id: string) => ['invoices', 'fiscal', id] as const,
  stats: (type?: 'SALE' | 'PURCHASE') => ['invoices', 'stats', type ?? 'ALL'] as const,
};

export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => invoicesApi.list(filters),
  });
}

export function useInvoiceStats(type?: 'SALE' | 'PURCHASE') {
  return useQuery({
    queryKey: invoiceKeys.stats(type),
    queryFn: () => invoicesApi.stats(type),
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ''),
    queryFn: () => invoicesApi.get(id as string),
    enabled: !!id,
  });
}

/** Ficha completa del documento (`GET /billing/invoices/:id` con líneas, pagos y saldo). */
export function useInvoiceDetail(id: string | null) {
  return useQuery({
    queryKey: invoiceKeys.document(id ?? ''),
    queryFn: () => invoicesApi.getDetail(id as string),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoicePayload) => invoicesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInvoicePayload) => invoicesApi.update(id, data),
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
      qc.invalidateQueries({ queryKey: invoiceKeys.document(data.id) });
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
      qc.invalidateQueries({ queryKey: invoiceKeys.document(data.id) });
      qc.setQueryData(invoiceKeys.detail(data.id), data);
    },
  });
}
