import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  usePartners,
  usePartner,
  usePartnerStatement,
  useCreatePartner,
  useDeletePartner,
} from './use-partners';
import { useAuthStore } from '@/stores/use-auth-store';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('partners hooks', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 't',
      user: { id: 'u', name: 'u', email: 'u@u.c', permissions: [], branches: [] },
      isAuthenticated: true,
      hasHydrated: true,
    });
  });

  it('usePartners() returns list of partners', async () => {
    const { result } = renderHook(() => usePartners(), { wrapper });
    await waitFor(() => expect(result.current.data?.data.length).toBeGreaterThan(0));
    expect(result.current.data?.total).toBeGreaterThan(0);
  });

  it('usePartners() filters by type', async () => {
    const { result } = renderHook(() => usePartners({ type: 'CUSTOMER' }), { wrapper });
    await waitFor(() =>
      expect(result.current.data?.data.every(p => p.type === 'CUSTOMER' || p.type === 'BOTH')).toBe(
        true
      )
    );
    expect(result.current.data?.data).toHaveLength(2);
  });

  it('usePartners() filters vendors against the backend list', async () => {
    const { result } = renderHook(() => usePartners({ type: 'VENDOR' }), { wrapper });
    await waitFor(() => expect(result.current.data?.data).toHaveLength(3));
    expect(result.current.data?.data.every(p => p.type === 'VENDOR' || p.type === 'BOTH')).toBe(
      true
    );
  });

  it('usePartners() filters partners that are both customer and vendor', async () => {
    const { result } = renderHook(() => usePartners({ type: 'BOTH' }), { wrapper });
    await waitFor(() => expect(result.current.data?.data).toHaveLength(1));
    expect(result.current.data?.data[0].type).toBe('BOTH');
  });

  it('usePartnerStatement() uses the treasury statement contract', async () => {
    const { result } = renderHook(() => usePartnerStatement('p-1'), { wrapper });
    await waitFor(() => {
      expect(result.current.data?.totalOutstanding).toBe(1500.5);
      expect(result.current.data?.recentPayments).toHaveLength(2);
    });
  });

  it('usePartner() returns single partner', async () => {
    const { result } = renderHook(() => usePartner('p-1'), { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe('p-1'));
  });

  it('usePartner() is disabled when id is null', () => {
    const { result } = renderHook(() => usePartner(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useCreatePartner() returns mutation', async () => {
    const { result } = renderHook(() => useCreatePartner(), { wrapper });
    expect(result.current.mutate).toBeDefined();
    expect(result.current.mutateAsync).toBeDefined();
  });

  it('useDeletePartner() is exposed', () => {
    const { result } = renderHook(() => useDeletePartner(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });
});
