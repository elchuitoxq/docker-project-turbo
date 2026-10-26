import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Branch = {
  id: string;
  companyId: string;
  name: string;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

interface BranchState {
  currentBranchId: string | null;
  availableBranches: Branch[];
  hasHydrated: boolean;
  setBranch: (id: string | null) => void;
  setAvailableBranches: (branches: Branch[]) => void;
  setHydrated: (v: boolean) => void;
  reset: () => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    set => ({
      currentBranchId: null,
      availableBranches: [],
      hasHydrated: false,
      setBranch: id => set({ currentBranchId: id }),
      setAvailableBranches: branches => set({ availableBranches: branches }),
      setHydrated: v => set({ hasHydrated: v }),
      reset: () => set({ currentBranchId: null, availableBranches: [] }),
    }),
    {
      name: 'erp.branch',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ currentBranchId: state.currentBranchId }),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    }
  )
);
