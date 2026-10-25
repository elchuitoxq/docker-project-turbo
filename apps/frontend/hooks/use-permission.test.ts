import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermission } from './use-permission';
import { useAuthStore } from '@/stores/use-auth-store';

describe('usePermission', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: null,
      user: {
        id: 'u-1',
        name: 'Test',
        email: 't@t.c',
        permissions: ['dashboard:view', 'finance:invoices:view'],
        branches: [],
      },
      isAuthenticated: true,
      hasHydrated: true,
    });
  });

  it('hasPermission() returns true for granted permission', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasPermission('dashboard:view')).toBe(true);
  });

  it('hasPermission() returns false for missing permission', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasPermission('hr:payroll:process')).toBe(false);
  });

  it('hasPermission() returns true for null/undefined (no requirement)', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasPermission(null)).toBe(true);
    expect(result.current.hasPermission(undefined)).toBe(true);
  });

  it('hasAnyPermission() returns true if any matches', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasAnyPermission(['none:here', 'dashboard:view'])).toBe(true);
  });

  it('hasAnyPermission() returns false if none match', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasAnyPermission(['a:b', 'c:d'])).toBe(false);
  });

  it('hasAllPermissions() returns true only when all match', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasAllPermissions(['dashboard:view', 'finance:invoices:view'])).toBe(true);
    expect(result.current.hasAllPermissions(['dashboard:view', 'hr:payroll:process'])).toBe(false);
  });

  it('hasAnyPermission() with empty list returns true', () => {
    const { result } = renderHook(() => usePermission());
    expect(result.current.hasAnyPermission([])).toBe(true);
  });
});
