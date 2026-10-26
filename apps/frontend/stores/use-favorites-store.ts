import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Favorite = {
  path: string;
  label: string;
  icon?: string;
};

interface FavoritesState {
  items: Favorite[];
  hasHydrated: boolean;
  add: (fav: Favorite) => void;
  remove: (path: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  setHydrated: (v: boolean) => void;
  reset: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    set => ({
      items: [],
      hasHydrated: false,
      add: fav =>
        set(state =>
          state.items.find(i => i.path === fav.path) ? state : { items: [...state.items, fav] }
        ),
      remove: path => set(state => ({ items: state.items.filter(i => i.path !== path) })),
      reorder: (fromIndex, toIndex) =>
        set(state => {
          const next = [...state.items];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { items: next };
        }),
      setHydrated: v => set({ hasHydrated: v }),
      reset: () => set({ items: [] }),
    }),
    {
      name: 'erp.favorites',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    }
  )
);
