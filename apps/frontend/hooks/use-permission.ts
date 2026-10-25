import { useAuthStore } from '@/stores/use-auth-store';
import { useShallow } from 'zustand/react/shallow';

export function usePermission() {
  const permissions = useAuthStore(useShallow((s) => s.user?.permissions ?? []));

  const hasPermission = (permission: string | undefined | null): boolean => {
    if (!permission) return true;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[] | undefined | null): boolean => {
    if (!perms || perms.length === 0) return true;
    return perms.some((p) => permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[] | undefined | null): boolean => {
    if (!perms || perms.length === 0) return true;
    return perms.every((p) => permissions.includes(p));
  };

  return { hasPermission, hasAnyPermission, hasAllPermissions, permissions };
}
