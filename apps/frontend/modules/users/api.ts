import { apiClient } from '@/lib/api/client';

export type UserBranch = {
  id: string;
  name: string;
  companyId: string;
  isDefault: boolean;
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
  updatedAt: string | null;
  roles: string[];
  branches: UserBranch[];
};

export type UserInput = {
  name: string;
  email: string;
  password: string;
  roleIds?: string[];
  branchIds?: string[];
  defaultBranchId?: string;
};

export const usersApi = {
  list: () => apiClient.get<ManagedUser[]>('/users'),
  create: (body: Pick<UserInput, 'name' | 'email' | 'password'>) =>
    apiClient.post<ManagedUser>('/users', body),
  update: (
    id: string,
    body: Partial<Omit<UserInput, 'roleIds' | 'branchIds' | 'defaultBranchId'>>
  ) => apiClient.patch<ManagedUser>(`/users/${id}`, body),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/users/${id}`),
  assignRoles: (id: string, roleIds: string[]) =>
    apiClient.post<ManagedUser>(`/users/${id}/roles`, { roleIds }),
  assignBranches: (id: string, branchIds: string[], defaultBranchId?: string) =>
    apiClient.post<ManagedUser>(`/users/${id}/branches`, { branchIds, defaultBranchId }),
};
