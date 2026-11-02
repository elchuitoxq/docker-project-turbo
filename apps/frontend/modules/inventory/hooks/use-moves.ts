'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { movesApi, type CreateMovePayload } from '../api/moves';

export const movesKeys = {
  all: ['inventory', 'moves'] as const,
  list: (filters: Record<string, string | number | undefined>) =>
    ['inventory', 'moves', 'list', filters] as const,
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
    mutationFn: (data: CreateMovePayload) => movesApi.create(data),
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

/** Aprobación en lote (`S-25`): un solo envío para varios borradores. */
export function useApproveMovesBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => movesApi.approveBatch(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movesKeys.all });
      // Aprobar mueve stock y recalcula el costo promedio: el listado de stock queda obsoleto.
      qc.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCancelMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => movesApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: movesKeys.all }),
  });
}
