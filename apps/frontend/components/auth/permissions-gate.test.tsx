import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionsGate } from './permissions-gate';
import { useAuthStore } from '@/stores/use-auth-store';

beforeEach(() => {
  useAuthStore.setState({
    token: null,
    user: { id: 'u', name: 'u', email: 'u@u.c', permissions: ['granted:perm'], branches: [] },
    isAuthenticated: true,
    hasHydrated: true,
  });
});

describe('PermissionsGate', () => {
  it('renders children when permission is granted', () => {
    render(
      <PermissionsGate permission="granted:perm">
        <span>child visible</span>
      </PermissionsGate>
    );
    expect(screen.getByText('child visible')).toBeInTheDocument();
  });

  it('renders nothing when permission is missing', () => {
    render(
      <PermissionsGate permission="other:perm">
        <span>child hidden</span>
      </PermissionsGate>
    );
    expect(screen.queryByText('child hidden')).not.toBeInTheDocument();
  });

  it('renders fallback when provided and permission missing', () => {
    render(
      <PermissionsGate permission="other:perm" fallback={<span>fallback</span>}>
        <span>child hidden</span>
      </PermissionsGate>
    );
    expect(screen.getByText('fallback')).toBeInTheDocument();
  });

  it('renders children when no permission specified', () => {
    render(
      <PermissionsGate>
        <span>no perm required</span>
      </PermissionsGate>
    );
    expect(screen.getByText('no perm required')).toBeInTheDocument();
  });

  it('honors anyPermission (OR)', () => {
    render(
      <PermissionsGate anyPermission={['no:here', 'granted:perm']}>
        <span>or match</span>
      </PermissionsGate>
    );
    expect(screen.getByText('or match')).toBeInTheDocument();
  });

  it('honors allPermissions (AND)', () => {
    render(
      <PermissionsGate allPermissions={['granted:perm', 'no:here']}>
        <span>and fail</span>
      </PermissionsGate>
    );
    expect(screen.queryByText('and fail')).not.toBeInTheDocument();
  });
});
