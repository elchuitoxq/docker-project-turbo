import { apiClient } from '@/lib/api/client';

/** Lote del producto tal como lo devuelve el backend, ordenado por FEFO (vence primero). */
export type ProductBatch = {
  id: string;
  productId: string;
  batchNumber: string;
  expirationDate: string | null;
  cost: string | null;
  /** Existencia disponible, ya descontadas las reservas activas (`S-26`). */
  availableQuantity?: string;
  /** Cantidad apartada por salidas en borrador (`S-26`). */
  reservedQuantity?: string;
  /** `false` = lote bloqueado: no se puede despachar (`S-26`). */
  isActive?: boolean;
  /** Ya venció: no se puede despachar (`S-26`). */
  expired?: boolean;
};

export type CreateBatchPayload = {
  batchNumber: string;
  /** Fecha ISO (`YYYY-MM-DD`) */
  expirationDate?: string;
  cost?: string;
};

export const batchesApi = {
  /**
   * Lotes del producto con la existencia del almacén indicado.
   *
   * Es lo que permite proponer el lote correcto en una salida (FEFO) en lugar de que el usuario lo
   * escriba a mano.
   */
  list: (productId: string, warehouseId?: string) =>
    apiClient.get<ProductBatch[]>(
      `/inventory/products/${productId}/batches${warehouseId ? `?warehouseId=${warehouseId}` : ''}`
    ),
  create: (productId: string, payload: CreateBatchPayload) =>
    apiClient.post<ProductBatch>(`/inventory/products/${productId}/batches`, payload),
};
