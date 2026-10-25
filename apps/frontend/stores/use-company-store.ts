import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Company = {
  id: string;
  taxId: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  branchCount: number;
  branches: Array<{ id: string; name: string; companyId: string; taxId: string | null }>;
};

interface CompanyState {
  currentCompanyId: string | null;
  legacyCompanyTaxId: string | null;
  availableCompanies: Company[];
  hasHydrated: boolean;
  setCompany: (id: string | null) => void;
  setAvailableCompanies: (companies: Company[]) => void;
  setHydrated: (v: boolean) => void;
  reset: () => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      currentCompanyId: null,
      legacyCompanyTaxId: null,
      availableCompanies: [],
      hasHydrated: false,
      setCompany: (id) => set({ currentCompanyId: id, legacyCompanyTaxId: null }),
      setAvailableCompanies: (companies) =>
        set((state) => ({
          availableCompanies: companies,
          currentCompanyId:
            state.currentCompanyId ??
            (state.legacyCompanyTaxId
              ? companies.find((company) => company.taxId === state.legacyCompanyTaxId)?.id
              : null) ??
            null,
          legacyCompanyTaxId: null,
        })),
      setHydrated: (v) => set({ hasHydrated: v }),
      reset: () => set({ currentCompanyId: null, legacyCompanyTaxId: null, availableCompanies: [] }),
    }),
    {
      name: 'erp.company',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({
        currentCompanyId: state.currentCompanyId,
        legacyCompanyTaxId: state.legacyCompanyTaxId,
      }),
      migrate: (persistedState) => {
        const previous = persistedState as { currentCompanyTaxId?: string | null };
        return {
          currentCompanyId: null,
          legacyCompanyTaxId: previous.currentCompanyTaxId ?? null,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
