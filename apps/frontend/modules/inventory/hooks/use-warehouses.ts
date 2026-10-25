'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warehousesApi, type Warehouse } from '../api/warehouses';

export const warehousesKeys = {
  all: ['warehouses'] as const,
};

export function useWarehouses() {
  return useQuery({
    queryKey: warehousesKeys.all,
    queryFn: () => warehousesApi.list(),
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Warehouse>) => warehousesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: warehousesKeys.all }),
  });
}

export function useUpdateWarehouse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Warehouse>) => warehousesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: warehousesKeys.all }),
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehousesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: warehousesKeys.all }),
  });
}
