'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { branchesApi, type Branch, type Company } from './api';
import { useCompanyStore } from '@/stores/use-company-store';
import { useBranchStore } from '@/stores/use-branch-store';
import { useAuthStore } from '@/stores/use-auth-store';
import { PERMISSIONS } from '@/lib/permissions';

export function useCompanies() {
  const isAuthed = useAuthStore(s => s.isAuthenticated);
  const canViewCompanies = useAuthStore(
    s => s.user?.permissions.includes(PERMISSIONS.SETTINGS.COMPANIES.VIEW) ?? false
  );
  return useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => branchesApi.listCompanies(),
    enabled: isAuthed && canViewCompanies,
    staleTime: 5 * 60_000,
  });
}

export function useBranches() {
  const isAuthed = useAuthStore(s => s.isAuthenticated);
  const canViewBranches = useAuthStore(
    s => s.user?.permissions.includes(PERMISSIONS.SETTINGS.BRANCHES.VIEW) ?? false
  );
  return useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => branchesApi.list(),
    enabled: isAuthed && canViewBranches,
    staleTime: 5 * 60_000,
  });
}

export function useCompanyContextSync() {
  const { data: companies = [], isSuccess: companiesLoaded } = useCompanies();
  const { data: branches = [], isSuccess: branchesLoaded } = useBranches();
  const setAvailableCompanies = useCompanyStore(s => s.setAvailableCompanies);
  const setAvailableBranches = useBranchStore(s => s.setAvailableBranches);
  const currentCompanyId = useCompanyStore(s => s.currentCompanyId);
  const setCompany = useCompanyStore(s => s.setCompany);
  const currentBranchId = useBranchStore(s => s.currentBranchId);
  const setBranch = useBranchStore(s => s.setBranch);
  const hasHydratedCompany = useCompanyStore(s => s.hasHydrated);
  const hasHydratedBranch = useBranchStore(s => s.hasHydrated);

  useEffect(() => {
    if (companiesLoaded) setAvailableCompanies(companies);
  }, [companies, companiesLoaded, setAvailableCompanies]);

  useEffect(() => {
    if (branchesLoaded) setAvailableBranches(branches);
  }, [branches, branchesLoaded, setAvailableBranches]);

  useEffect(() => {
    if (!hasHydratedCompany || !hasHydratedBranch) return;
    if (companies.length === 0) return;

    if (!currentCompanyId || !companies.find(c => c.id === currentCompanyId)) {
      setCompany(companies[0]?.id ?? null);
    }
  }, [companies, currentCompanyId, hasHydratedCompany, hasHydratedBranch, setCompany]);

  useEffect(() => {
    if (!hasHydratedCompany || !hasHydratedBranch) return;
    if (!currentCompanyId) return;

    const availableForCompany = branches.filter(branch => branch.companyId === currentCompanyId);

    if (currentBranchId && !availableForCompany.find(b => b.id === currentBranchId)) {
      setBranch(availableForCompany[0]?.id ?? null);
    } else if (!currentBranchId && availableForCompany.length > 0) {
      setBranch(availableForCompany[0].id);
    }
  }, [
    branches,
    currentCompanyId,
    currentBranchId,
    hasHydratedCompany,
    hasHydratedBranch,
    setBranch,
  ]);
}
