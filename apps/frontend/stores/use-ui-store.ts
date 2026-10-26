import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Language = 'es-VE' | 'en-US';

interface UiState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  language: Language;
  hasHydrated: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (v: boolean) => void;
  toggleCommandPalette: () => void;
  setLanguage: (l: Language) => void;
  setHydrated: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    set => ({
      sidebarOpen: true,
      commandPaletteOpen: false,
      language: 'es-VE',
      hasHydrated: false,
      setSidebarOpen: v => set({ sidebarOpen: v }),
      toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
      setCommandPaletteOpen: v => set({ commandPaletteOpen: v }),
      toggleCommandPalette: () => set(s => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setLanguage: l => set({ language: l }),
      setHydrated: v => set({ hasHydrated: v }),
    }),
    {
      name: 'erp.ui',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ sidebarOpen: state.sidebarOpen, language: state.language }),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    }
  )
);
