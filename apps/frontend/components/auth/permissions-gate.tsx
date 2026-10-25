'use client';

import * as React from 'react';
import { usePermission } from '@/hooks/use-permission';

type Props = {
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function PermissionsGate({
  permission,
  anyPermission,
  allPermissions,
  fallback = null,
  children,
}: Props) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermission();

  let allowed = true;
  if (permission) allowed = allowed && hasPermission(permission);
  if (anyPermission) allowed = allowed && hasAnyPermission(anyPermission);
  if (allPermissions) allowed = allowed && hasAllPermissions(allPermissions);

  return <>{allowed ? children : fallback}</>;
}
