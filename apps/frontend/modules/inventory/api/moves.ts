import { apiClient } from '@/lib/api/client';

export type MoveType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
export type MoveStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';

export type Move = {
  id: string;
  code: string;
  type: MoveType;
  status: MoveStatus;
  productId: string;
  productName?: string;
  productSku?: string;
  warehouseId: string;
  warehouseName?: string;
  warehouseDestId?: string | null;
  warehouseDestName?: string | null;
  quantity: string;
  unitCost: string;
  totalCost: string;
  reason?: string;
  date: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
};

function buildQuery(filters: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const movesApi = {
  list: (
    filters: {
      type?: MoveType;
      status?: MoveStatus;
      warehouseId?: string;
      page?: number;
      limit?: number;
    } = {}
  ) =>
    apiClient.get<{ data: Move[]; total: number; page: number; limit: number }>(
      `/inventory/moves${buildQuery(filters)}`
    ),
  get: (id: string) => apiClient.get<Move>(`/inventory/moves/${id}`),
  create: (data: Partial<Move>) => apiClient.post<Move>('/inventory/moves', data),
  approve: (id: string) => apiClient.post<Move>(`/inventory/moves/${id}/approve`, {}),
  cancel: (id: string) => apiClient.post<Move>(`/inventory/moves/${id}/cancel`, {}),
};
