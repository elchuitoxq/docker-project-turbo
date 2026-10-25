import { apiClient } from '@/lib/api/client';

export type Permission = {
  id: string;
  code: string;
  description: string | null;
  module: string;
};

export type ManagedRole = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
};

export const rolesApi = {
  list: () => apiClient.get<ManagedRole[]>('/roles'),
  listPermissions: () => apiClient.get<Permission[]>('/roles/permissions'),
  create: (body: { name: string; description?: string; permissionIds?: string[] }) =>
    apiClient.post<ManagedRole>('/roles', body),
  update: (
    id: string,
    body: { name?: string; description?: string; permissionIds?: string[] },
  ) => apiClient.patch<ManagedRole>(`/roles/${id}`, body),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/roles/${id}`),
};
