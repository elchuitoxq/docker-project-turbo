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

export const productsApi = {
  list: (filters?: ProductFilters) =>
    apiClient.get<{ data: Product[]; total: number; page: number; limit: number }>(
      `/products${buildQuery(filters)}`
    ),
  get: (id: string) => apiClient.get<Product>(`/products/${id}`),
  create: (data: Partial<Product>) => apiClient.post<Product>('/products', data),
  update: (id: string, data: Partial<Product>) => apiClient.patch<Product>(`/products/${id}`, data),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/products/${id}`),
  listCategories: () => apiClient.get<ProductCategory[]>('/product-categories'),
};
