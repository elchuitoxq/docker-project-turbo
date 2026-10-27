import { apiClient } from '@/lib/api/client';

export type Warehouse = {
  id: string;
  branchId: string | null;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt?: string;
};

export const warehousesApi = {
  list: () => apiClient.get<Warehouse[]>('/inventory/warehouses'),
  get: (id: string) => apiClient.get<Warehouse>(`/inventory/warehouses/${id}`),
  create: (data: Partial<Warehouse>) => apiClient.post<Warehouse>('/inventory/warehouses', data),
  update: (id: string, data: Partial<Warehouse>) =>
    apiClient.patch<Warehouse>(`/inventory/warehouses/${id}`, data),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/inventory/warehouses/${id}`),
};
