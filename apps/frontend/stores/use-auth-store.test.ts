import { describe, it, expect, beforeEach } from 'vitest';
import { isAuthUser, useAuthStore } from './use-auth-store';

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.removeItem('erp.auth');
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false, hasHydrated: false });
  });

  it('starts with no auth', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('validates the user fields required by the dashboard', () => {
    expect(
      isAuthUser({
        id: 'u-1',
        name: 'Ana',
        email: 'ana@test.com',
        permissions: ['dashboard:view'],
        branches: [{ id: 'b-1', name: 'Main', taxId: null }],
      }),
    ).toBe(true);
    expect(isAuthUser({ id: 'u-1', name: 'Ana', email: 'ana@test.com' })).toBe(false);
  });

  it('login() sets token, user and isAuthenticated', () => {
    const user = {
      id: 'u-1',
      name: 'Ana',
      email: 'ana@test.com',
      permissions: ['dashboard:view'],
      branches: [],
    };
    useAuthStore.getState().login('jwt-123', user);
    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-123');
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('logout() clears auth state', () => {
    useAuthStore.getState().login('jwt-123', {
      id: 'u-1',
      name: 'A',
      email: 'a@b.c',
      permissions: [],
      branches: [],
    });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setUser() updates user only', () => {
    useAuthStore.getState().login('t', {
      id: '1',
      name: 'a',
      email: 'a@b.c',
      permissions: [],
      branches: [],
    });
    useAuthStore.getState().setUser({ id: '1', name: 'B', email: 'a@b.c', permissions: [], branches: [] });
    expect(useAuthStore.getState().user?.name).toBe('B');
    expect(useAuthStore.getState().token).toBe('t');
  });

  it('clears persisted sessions with incomplete user permissions', async () => {
    localStorage.setItem(
      'erp.auth',
      JSON.stringify({
        state: {
          token: 'legacy-token',
          user: { id: 'u-1', name: 'Ana', email: 'ana@test.com' },
          isAuthenticated: true,
        },
        version: 0,
      }),
    );

    await useAuthStore.persist.rehydrate();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.hasHydrated).toBe(true);
  });
});
