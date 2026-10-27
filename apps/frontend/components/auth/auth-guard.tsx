'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { isAuthUser } from '@/stores/use-auth-store';
import { apiClient } from '@/lib/api/client';
import { useCompanyStore } from '@/stores/use-company-store';
import { useBranchStore } from '@/stores/use-branch-store';
import { useQueryClient } from '@tanstack/react-query';
import { useCompanies } from '@/modules/branches/hooks';
import { PERMISSIONS } from '@/lib/permissions';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const hasHydratedAuth = useAuthStore(s => s.hasHydrated);
  const canViewCompanies = useAuthStore(
    s => s.user?.permissions.includes(PERMISSIONS.SETTINGS.COMPANIES.VIEW) ?? false
  );
  const currentCompanyId = useCompanyStore(s => s.currentCompanyId);
  const hasHydratedCompany = useCompanyStore(s => s.hasHydrated);
  const currentBranchId = useBranchStore(s => s.currentBranchId);
  const hasHydratedBranch = useBranchStore(s => s.hasHydrated);
  const setAvailableCompanies = useCompanyStore(s => s.setAvailableCompanies);
  const setCompany = useCompanyStore(s => s.setCompany);
  const setAvailableBranches = useBranchStore(s => s.setAvailableBranches);
  const setBranch = useBranchStore(s => s.setBranch);
  const setUser = useAuthStore(s => s.setUser);
  const defaultBranchId = useAuthStore(s => s.user?.defaultBranchId ?? null);

  // Refresca permisos/sucursales contra el backend usando la cookie httpOnly.
  React.useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    apiClient
      .get<unknown>('/auth/me')
      .then(profile => {
        if (!cancelled && isAuthUser(profile)) setUser(profile);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setUser]);

  const companiesQuery = useCompanies();
  const companies = companiesQuery.data ?? [];
  const companiesLoaded = companiesQuery.isSuccess;
  const selectedCompany = companies.find(company => company.id === currentCompanyId);
  const contextReady = Boolean(
    selectedCompany?.branches.some(branch => branch.id === currentBranchId)
  );

  React.useEffect(() => {
    if (!companiesLoaded || companies.length === 0) return;
    setAvailableCompanies(companies);

    if (!currentCompanyId || !companies.some(company => company.id === currentCompanyId)) {
      setCompany(companies[0]?.id ?? null);
    }
  }, [companiesLoaded, companies, currentCompanyId, setAvailableCompanies, setCompany]);

  React.useEffect(() => {
    if (!companiesLoaded || !currentCompanyId) return;

    const company = companies.find(item => item.id === currentCompanyId);
    const branchesForCompany = company?.branches ?? [];
    setAvailableBranches(branchesForCompany);

    const currentBranchValid =
      currentBranchId && branchesForCompany.some(b => b.id === currentBranchId);

    if (!currentBranchValid && branchesForCompany.length > 0) {
      // Preferimos la sucursal predeterminada del backend sobre "la primera que aparezca".
      const preferred =
        defaultBranchId && branchesForCompany.some(b => b.id === defaultBranchId)
          ? defaultBranchId
          : branchesForCompany[0].id;
      setBranch(preferred);
    } else if (!currentBranchValid && branchesForCompany.length === 0) {
      const companyWithBranches = companies.find(c => c.branches.length > 0);
      if (companyWithBranches) {
        setCompany(companyWithBranches.id);
      }
    }
  }, [
    companiesLoaded,
    currentCompanyId,
    currentBranchId,
    defaultBranchId,
    companies,
    setAvailableBranches,
    setBranch,
    setCompany,
  ]);

  // R3 de S-00: cambiar de sucursal invalida la caché de datos del servidor.
  const previousBranchId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!hasHydratedBranch) return;

    const previous = previousBranchId.current;
    previousBranchId.current = currentBranchId;

    if (previous && currentBranchId && previous !== currentBranchId) {
      queryClient.clear();
    }
  }, [currentBranchId, hasHydratedBranch, queryClient]);

  React.useEffect(() => {
    if (!hasHydratedAuth || !hasHydratedCompany || !hasHydratedBranch) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (!canViewCompanies) {
      router.replace('/forbidden?reason=no-company');
      return;
    }

    if (companiesQuery.isError) return;
    if (!companiesLoaded) return;

    if (companies.length === 0) {
      router.replace('/forbidden?reason=no-company');
      return;
    }

    if (!selectedCompany) return;

    if (selectedCompany.branches.length === 0) {
      if (companies.some(company => company.branches.length > 0)) return;
      router.replace('/forbidden?reason=no-branch');
    }
  }, [
    hasHydratedAuth,
    hasHydratedCompany,
    hasHydratedBranch,
    isAuthenticated,
    canViewCompanies,
    companiesQuery.isError,
    companiesLoaded,
    companies,
    selectedCompany,
    router,
  ]);

  React.useEffect(() => {
    if (isAuthenticated) {
      queryClient.resumePausedMutations();
    }
  }, [isAuthenticated, queryClient]);

  if (companiesQuery.isError) {
    return (
      <div role="alert" className="flex h-screen w-full items-center justify-center px-6">
        <p className="max-w-lg text-center text-sm text-destructive">
          No se pudo cargar el contexto de empresas. {companiesQuery.error.message}
        </p>
      </div>
    );
  }

  if (
    !hasHydratedAuth ||
    !hasHydratedCompany ||
    !hasHydratedBranch ||
    !isAuthenticated ||
    !canViewCompanies ||
    !companiesLoaded ||
    (companies.length > 0 && !contextReady)
  ) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  return <>{children}</>;
}
