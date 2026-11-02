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

/**
 * Almacenes para un selector (`GET /inventory/warehouses/options`).
 *
 * El catálogo completo exige `inventory:warehouses:view`, permiso que los roles operativos no tienen;
 * esta variante sólo pide `inventory:products:view`, que sí tienen, y devuelve id y nombre.
 */
export function useWarehouseOptions(enabled = true) {
  return useQuery({
    queryKey: [...warehousesKeys.all, 'options'],
    queryFn: () => warehousesApi.options(),
    enabled,
    staleTime: 10 * 60_000,
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
