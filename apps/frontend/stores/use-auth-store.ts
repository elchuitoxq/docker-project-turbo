import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { env } from '@/lib/env';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  permissions: string[];
  branches: Array<{ id: string; name: string; taxId: string | null }>;
  /** Sucursal con la que debe arrancar la UI (viene de `/auth/me`). */
  defaultBranchId?: string | null;
};

export function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !('email' in value) ||
    typeof value.email !== 'string' ||
    !('permissions' in value) ||
    !Array.isArray(value.permissions) ||
    !value.permissions.every(permission => typeof permission === 'string') ||
    !('branches' in value) ||
    !Array.isArray(value.branches)
  ) {
    return false;
  }

  return value.branches.every(
    branch =>
      typeof branch === 'object' &&
      branch !== null &&
      'id' in branch &&
      typeof branch.id === 'string' &&
      'name' in branch &&
      typeof branch.name === 'string' &&
      'taxId' in branch &&
      (typeof branch.taxId === 'string' || branch.taxId === null)
  );
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  setHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      token: null,
      user: null,
      isAuthenticated: false,
      hasHydrated: false,
      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => {
        // Borra la cookie httpOnly del backend (fire-and-forget).
        if (typeof window !== 'undefined') {
          void fetch(`${env.NEXT_PUBLIC_API_URL}${env.NEXT_PUBLIC_API_PREFIX}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => undefined);
        }
        set({ token: null, user: null, isAuthenticated: false });
      },
      setUser: user => set({ user }),
      setHydrated: v => set({ hasHydrated: v }),
    }),
    {
      name: 'erp.auth',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // El token ya no se persiste: la sesión vive en la cookie httpOnly.
      partialize: state => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      migrate: persisted => {
        const legacy = persisted as Partial<AuthState> | undefined;
        return {
          user: legacy?.user ?? null,
          isAuthenticated: Boolean(legacy?.isAuthenticated),
        } as unknown as AuthState;
      },
      onRehydrateStorage: () => state => {
        if (state?.isAuthenticated && !isAuthUser(state.user)) {
          state.logout();
        }
        state?.setHydrated(true);
      },
    }
  )
);
