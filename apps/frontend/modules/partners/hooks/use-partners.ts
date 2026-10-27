'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { partnersApi } from '../api';
import type { Partner, PartnerFilters, PartnerStatement } from '../types';

export const partnersKeys = {
  all: ['partners'] as const,
  list: (filters: PartnerFilters) => ['partners', 'list', filters] as const,
  detail: (id: string) => ['partners', 'detail', id] as const,
  statement: (id: string) => ['partners', 'statement', id] as const,
};

export function usePartners(filters: PartnerFilters = {}) {
  return useQuery({
    queryKey: partnersKeys.list(filters),
    queryFn: () => partnersApi.list(filters),
  });
}

export function usePartner(id: string | null) {
  return useQuery({
    queryKey: partnersKeys.detail(id ?? ''),
    queryFn: () => partnersApi.get(id as string),
    enabled: !!id,
  });
}

export function useCreatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Partner>) => partnersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnersKeys.all });
    },
  });
}

export function useUpdatePartner(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Partner>) => partnersApi.update(id, data),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: partnersKeys.all });
      qc.setQueryData(partnersKeys.detail(id), data);
    },
  });
}

export function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => partnersApi.remove(id),
    onMutate: async id => {
      await qc.cancelQueries({ queryKey: partnersKeys.all });
      const previous = qc.getQueriesData({ queryKey: partnersKeys.all });
      qc.setQueriesData<{ data: Partner[]; total: number }>({ queryKey: partnersKeys.all }, old =>
        old ? { ...old, data: old.data.filter(p => p.id !== id), total: old.total - 1 } : old
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        for (const [key, value] of ctx.previous) qc.setQueryData(key, value);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: partnersKeys.all }),
  });
}

export function usePartnerStatement(id: string | null, range: { from?: string; to?: string } = {}) {
  return useQuery<PartnerStatement>({
    queryKey: [...partnersKeys.statement(id ?? ''), range.from ?? '', range.to ?? ''],
    queryFn: () => partnersApi.statement(id as string, range),
    enabled: !!id,
  });
}
