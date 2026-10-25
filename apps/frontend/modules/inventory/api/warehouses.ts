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
  list: () => apiClient.get<Warehouse[]>('/warehouses'),
  get: (id: string) => apiClient.get<Warehouse>(`/warehouses/${id}`),
  create: (data: Partial<Warehouse>) => apiClient.post<Warehouse>('/warehouses', data),
  update: (id: string, data: Partial<Warehouse>) => apiClient.patch<Warehouse>(`/warehouses/${id}`, data),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/warehouses/${id}`),
};
