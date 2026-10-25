import { apiClient } from '@/lib/api/client';

export type Branch = {
  id: string;
  companyId: string;
  name: string;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt?: string;
};

export type Company = {
  id: string;
  taxId: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  branchCount: number;
  branches: Branch[];
};

export const branchesApi = {
  list: () => apiClient.get<Branch[]>('/branches'),
  listAll: () => apiClient.get<Branch[]>('/branches/all'),
  listCompanies: () => apiClient.get<Company[]>('/branches/companies'),
  listAllCompanies: () => apiClient.get<Company[]>('/branches/companies/all'),
  createCompany: (body: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
  }) =>
    apiClient.post<Company>('/branches/companies', body),
  updateCompany: (
    id: string,
    body: { name?: string; taxId?: string; address?: string; phone?: string; email?: string; isActive?: boolean },
  ) =>
    apiClient.patch<Company>(`/branches/companies/${id}`, body),
  create: (body: { companyId: string; name: string; address?: string; phone?: string; email?: string }) =>
    apiClient.post<Branch>('/branches', body),
  update: (id: string, body: Partial<{ companyId: string; name: string; address: string; phone: string; email: string; isActive: boolean }>) =>
    apiClient.patch<Branch>(`/branches/${id}`, body),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/branches/${id}`),
  get: (id: string) => apiClient.get<Branch>(`/branches/${id}`),
};
