import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProducts, useProduct, useProductCategories } from './use-products';
import { useAuthStore } from '@/stores/use-auth-store';

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('inventory hooks', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 't',
      user: { id: 'u', name: 'u', email: 'u@u.c', permissions: [], branches: [] },
      isAuthenticated: true,
      hasHydrated: true,
    });
  });

  it('useProducts() returns list', async () => {
    const { result } = renderHook(() => useProducts(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.data.length).toBeGreaterThan(0));
  });

  it('useProduct() is enabled with id', async () => {
    const { result } = renderHook(() => useProduct('pr-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe('pr-1'));
  });

  it('useProduct() disabled without id', () => {
    const { result } = renderHook(() => useProduct(null), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useProductCategories() returns categories', async () => {
    const { result } = renderHook(() => useProductCategories(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.length).toBeGreaterThan(0));
  });
});
