import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  usePayrollSettings,
  usePayrollConcepts,
  useVacationSummary,
  useBenefitsSummary,
  useSettlement,
  usePayPayroll,
} from './hooks';
import { useAuthStore } from '@/stores/use-auth-store';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('hr payroll hooks', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 't',
      user: { id: 'u', name: 'u', email: 'u@u.c', permissions: [], branches: [] },
      isAuthenticated: true,
      hasHydrated: true,
    });
  });

  it('usePayrollSettings() devuelve un valor por clave', async () => {
    const { result } = renderHook(() => usePayrollSettings(), { wrapper });

    await waitFor(() => expect(result.current.data?.length).toBeGreaterThan(0));
    const keys = (result.current.data ?? []).map(setting => setting.key);
    expect(keys).toContain('SSO_EMP');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('usePayrollConcepts() trae el catálogo con su naturaleza', async () => {
    const { result } = renderHook(() => usePayrollConcepts(), { wrapper });

    await waitFor(() => expect(result.current.data?.length).toBeGreaterThan(0));
    const cestaticket = result.current.data?.find(concept => concept.code === 'CESTATICKET');
    expect(cestaticket?.isSalarial).toBe(false);
  });

  it('useVacationSummary() calcula los días por antigüedad', async () => {
    const { result } = renderHook(() => useVacationSummary('e-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.years).toBe(3));
    expect(result.current.data?.vacationDays).toBe(17);
    expect(result.current.data?.bonusDays).toBe(9);
  });

  it('useBenefitsSummary() informa la modalidad que se paga', async () => {
    const { result } = renderHook(() => useBenefitsSummary('e-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.modality).toBe('RETROACTIVE'));
    expect(result.current.data?.payable).toBeCloseTo(33083.33, 2);
  });

  it('useSettlement() devuelve el desglose del egreso', async () => {
    const { result } = renderHook(() => useSettlement('e-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.cause).toBe('RENUNCIA'));
    expect(result.current.data?.totalAmount).toBeCloseTo(50083.33, 2);
  });

  it('usePayPayroll() registra el pago una sola vez', async () => {
    const { result } = renderHook(() => usePayPayroll(), { wrapper });

    result.current.mutate({ id: 'pr-2', body: { methodId: 'm-1' } });

    await waitFor(() => expect(result.current.data?.paymentCode).toBe('PAY-00001'));
    expect(result.current.data?.alreadyPaid).toBe(false);
    expect(result.current.data?.amount).toBeCloseTo(10910, 2);
  });
});
