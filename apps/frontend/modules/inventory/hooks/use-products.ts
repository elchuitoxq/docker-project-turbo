'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../api/products';
import type { Product, ProductFilters } from '../types';

export const productsKeys = {
  all: ['products'] as const,
  list: (filters: ProductFilters) => ['products', 'list', filters] as const,
  detail: (id: string) => ['products', 'detail', id] as const,
};

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: productsKeys.list(filters),
    queryFn: () => productsApi.list(filters),
  });
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: productsKeys.detail(id ?? ''),
    queryFn: () => productsApi.get(id as string),
    enabled: !!id,
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productsApi.listCategories(),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product>) => productsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKeys.all }),
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product>) => productsApi.update(id, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: productsKeys.all });
      qc.setQueryData(productsKeys.detail(id), data);
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: productsKeys.all });
      const previous = qc.getQueriesData({ queryKey: productsKeys.all });
      qc.setQueriesData<{ data: Product[]; total: number }>(
        { queryKey: productsKeys.all },
        (old) => (old ? { ...old, data: old.data.filter((p) => p.id !== id), total: old.total - 1 } : old),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        for (const [key, value] of ctx.previous) qc.setQueryData(key, value);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: productsKeys.all }),
  });
}
