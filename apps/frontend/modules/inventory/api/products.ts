import { apiClient } from '@/lib/api/client';
import type { Product, ProductCategory, ProductFilters } from '../types';

function buildQuery(filters: ProductFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.type) params.set('type', filters.type);
  if (filters.search) params.set('search', filters.search);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export type ProductPayload = Omit<Partial<Product>, 'cost' | 'price' | 'taxRate' | 'minStock'> & {
  /** El API espera números en estos campos (los inputs devuelven texto). */
  cost?: number;
  price?: number;
  taxRate?: number;
  minStock?: number;
};

function paginate(rows: Product[], filters: ProductFilters = {}) {
  const filtered = rows.filter(product => {
    if (filters.type && product.type !== filters.type) return false;
    if (filters.categoryId && product.categoryId !== filters.categoryId) return false;
    if (filters.search) {
      const term = filters.search.toLowerCase();
      return product.sku.toLowerCase().includes(term) || product.name.toLowerCase().includes(term);
    }
    return true;
  });

  const page = filters.page ?? 1;
  const limit = filters.limit ?? Math.max(filtered.length, 1);
  const start = (page - 1) * limit;

  return {
    data: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
  };
}

export const productsApi = {
  /**
   * El listado del backend responde un arreglo plano; se normaliza a la forma paginada que
   * consumen las vistas (mismo patrón que `partnersApi.list`).
   */
  list: async (filters?: ProductFilters) => {
    const response = await apiClient.get<
      Product[] | { data: Product[]; total: number; page: number; limit: number }
    >(`/products${buildQuery(filters)}`);

    if (Array.isArray(response)) return paginate(response, filters);
    return response;
  },
  get: (id: string) => apiClient.get<Product>(`/products/${id}`),
  create: (data: ProductPayload) => apiClient.post<Product>('/products', data),
  update: (id: string, data: ProductPayload) => apiClient.patch<Product>(`/products/${id}`, data),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/products/${id}`),
  listCategories: () => apiClient.get<ProductCategory[]>('/products/categories'),
};
