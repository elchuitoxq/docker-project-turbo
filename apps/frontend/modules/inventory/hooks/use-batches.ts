'use client';

import { useQuery } from '@tanstack/react-query';
import { batchesApi } from '../api/batches';

export const batchesKeys = {
  list: (productId: string, warehouseId?: string) =>
    ['inventory', 'batches', productId, warehouseId ?? null] as const,
};

/**
 * Lotes del producto ordenados por FEFO.
 *
 * `enabled` deja la consulta apagada mientras no haya producto elegido, para no disparar una petición
 * por cada línea vacía del formulario.
 */
export function useProductBatches(productId: string, warehouseId?: string) {
  return useQuery({
    queryKey: batchesKeys.list(productId, warehouseId),
    queryFn: () => batchesApi.list(productId, warehouseId),
    enabled: Boolean(productId),
  });
}
