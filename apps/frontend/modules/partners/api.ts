import { apiClient } from '@/lib/api/client';
import type { Partner, PartnerFilters, PartnerStatement } from './types';
import { matchesPartnerType } from './types';

function buildQuery(filters: PartnerFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.type) params.set('type', filters.type);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export type PartnerPayload = Omit<Partial<Partner>, 'retentionRate' | 'creditLimit'> & {
  /** El API espera números: `retentionRate`/`creditLimit` llegan como texto del formulario. */
  retentionRate?: number;
  creditLimit?: number;
};

export const partnersApi = {
  list: async (filters: PartnerFilters = {}) => {
    const partners = await apiClient.get<Partner[]>(`/partners${buildQuery(filters)}`);
    const filtered = filters.type
      ? partners.filter(partner => matchesPartnerType(partner.type, filters.type))
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
  create: (data: PartnerPayload) => apiClient.post<Partner>('/partners', data),
  update: (id: string, data: PartnerPayload) => apiClient.patch<Partner>(`/partners/${id}`, data),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/partners/${id}`),
  statement: (id: string, range: { from?: string; to?: string } = {}) => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    const qs = params.toString();
    return apiClient.get<PartnerStatement>(`/treasury/statements/${id}${qs ? `?${qs}` : ''}`);
  },
};
