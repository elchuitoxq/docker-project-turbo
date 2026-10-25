'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { movesApi, type Move } from '../api/moves';

export const movesKeys = {
  all: ['inventory', 'moves'] as const,
  list: (filters: Record<string, string | number | undefined>) => ['inventory', 'moves', 'list', filters] as const,
};

export function useMoves(filters: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: movesKeys.list(filters),
    queryFn: () => movesApi.list(filters),
  });
}

export function useCreateMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Move>) => movesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: movesKeys.all }),
  });
}

export function useApproveMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => movesApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: movesKeys.all }),
  });
}

export function useCancelMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => movesApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: movesKeys.all }),
  });
}
