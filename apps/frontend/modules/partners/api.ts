import { apiClient } from '@/lib/api/client';
import type { Partner, PartnerFilters, PartnerStatement } from './types';

function buildSearchQuery(search?: string): string {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const partnersApi = {
  list: async (filters: PartnerFilters = {}) => {
    const partners = await apiClient.get<Partner[]>(`/partners${buildSearchQuery(filters.search)}`);
    const filtered = filters.type
      ? partners.filter(partner => partner.type === filters.type)
      : partners;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? Math.max(filtered.length, 1);
    const start = (page - 1) * limit;

    return {
      data: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
    };
  },
  get: (id: string) => apiClient.get<Partner>(`/partners/${id}`),
  create: (data: Partial<Partner>) => apiClient.post<Partner>('/partners', data),
  update: (id: string, data: Partial<Partner>) => apiClient.patch<Partner>(`/partners/${id}`, data),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/partners/${id}`),
  statement: (id: string) => apiClient.get<PartnerStatement>(`/treasury/statements/${id}`),
};
