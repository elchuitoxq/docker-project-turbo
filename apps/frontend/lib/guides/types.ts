/**
 * Modelo de la guía funcional.
 *
 * El contenido es data-driven: cada submódulo declara el permiso real que lo abre y las acciones
 * que habilita. La guía nunca redefine permisos, sólo los referencia desde `lib/permissions.ts`.
 */

export type GuideModuleId = 'inventory' | 'operations' | 'finance' | 'hr' | 'settings';

export type GuideAction = {
  label: string;
  /** Código exacto de `PERMISSIONS` que habilita la acción. */
  permission: string;
};

export type GuideSubmodule = {
  id: string;
  title: string;
  /** Pantalla real que documenta la guía. */
  href: string;
  summary: string;
  /** Permiso que abre la pantalla. */
  viewPermission?: string;
  /** Basta uno de estos permisos para abrir la pantalla. */
  viewAnyPermissions?: string[];
  actions: GuideAction[];
  steps: string[];
  rules: string[];
  pitfalls: { symptom: string; cause: string }[];
  /** Advertencia de acción irreversible (anular, cerrar período, procesar nómina). */
  caution?: string;
};

export type GuideModule = {
  id: GuideModuleId;
  title: string;
  description: string;
  href: string;
  /** Permiso de entrada al módulo (`inventory:view`, `finance:view`, …). */
  permission: string;
  icon: 'Warehouse' | 'Briefcase' | 'Banknote' | 'Users' | 'Settings';
  submodules: GuideSubmodule[];
};

export type GuideRoleId =
  'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER' | 'WAREHOUSE' | 'ACCOUNTANT';

export type GuideRole = {
  id: GuideRoleId;
  label: string;
  description: string;
  /** Lista explícita de permisos. `null` = todos los permisos del sistema. */
  permissions: string[] | null;
};

export type AccessLevel = 'full' | 'partial' | 'none';
