import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCompanies, useBranches } from './hooks';
import { useCompanyStore } from '@/stores/use-company-store';
import { useBranchStore } from '@/stores/use-branch-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('branches hooks', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 't',
      user: {
        id: 'u',
        name: 'u',
        email: 'u@u.c',
        permissions: ['settings:companies:view', 'settings:branches:view'],
        branches: [],
      },
      isAuthenticated: true,
      hasHydrated: true,
    });
    useCompanyStore.setState({
      currentCompanyId: null,
      legacyCompanyTaxId: null,
      availableCompanies: [],
      hasHydrated: true,
    });
    useBranchStore.setState({ currentBranchId: null, availableBranches: [], hasHydrated: true });
  });

  it('useCompanies() returns companies from API', async () => {
    expect(useAuthStore.getState().user?.permissions).toContain('settings:companies:view');
    const { result } = renderHook(() => useCompanies(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.length).toBeGreaterThan(0);
  });

  it('useBranches() returns branches from API', async () => {
    const { result } = renderHook(() => useBranches(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.length).toBeGreaterThan(0);
  });

  it('does not request companies without the view permission', async () => {
    useAuthStore.setState(state => ({
      user: state.user ? { ...state.user, permissions: [] } : null,
    }));

    const { result } = renderHook(() => useCompanies(), { wrapper: Wrapper });
    await new Promise(r => setTimeout(r, 50));

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('does not request branches without the view permission', async () => {
    useAuthStore.setState(state => ({
      user: state.user ? { ...state.user, permissions: [] } : null,
    }));

    const { result } = renderHook(() => useBranches(), { wrapper: Wrapper });
    await new Promise(r => setTimeout(r, 50));

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});
