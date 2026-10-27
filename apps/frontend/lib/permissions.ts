export const PERMISSIONS = {
  CORE: {
    /** Modo consolidado: permite operar sobre sucursales no asignadas (sólo SUPER_ADMIN). */
    BRANCH_ALL: 'core:branch:all',
    /** Escritura de maestros compartidos entre sucursales (partners, products, banks). */
    CATALOG_MANAGE: 'core:catalog:manage',
  },
  DASHBOARD: { VIEW: 'dashboard:view' },
  OPERATIONS: {
    VIEW: 'operations:view',
    PARTNERS: {
      VIEW: 'operations:partners:view',
      CREATE: 'operations:partners:create',
      EDIT: 'operations:partners:edit',
      DELETE: 'operations:partners:delete',
      STATEMENT: 'operations:partners:statement',
    },
    SALES: {
      VIEW: 'operations:sales:view',
      CREATE: 'operations:sales:create',
      EDIT: 'operations:sales:edit',
    },
    PURCHASES: {
      VIEW: 'operations:purchases:view',
      CREATE: 'operations:purchases:create',
      EDIT: 'operations:purchases:edit',
    },
    ORDERS: {
      VIEW: 'operations:orders:view',
      CREATE: 'operations:orders:create',
      EDIT: 'operations:orders:edit',
      APPROVE: 'operations:orders:approve',
    },
  },
  INVENTORY: {
    VIEW: 'inventory:view',
    PRODUCTS: {
      VIEW: 'inventory:products:view',
      CREATE: 'inventory:products:create',
      EDIT: 'inventory:products:edit',
      DELETE: 'inventory:products:delete',
    },
    WAREHOUSES: {
      VIEW: 'inventory:warehouses:view',
      CREATE: 'inventory:warehouses:create',
      EDIT: 'inventory:warehouses:edit',
    },
    MOVES: {
      VIEW: 'inventory:moves:view',
      CREATE: 'inventory:moves:create',
      APPROVE: 'inventory:moves:approve',
    },
  },
  FINANCE: {
    VIEW: 'finance:view',
    INVOICES: {
      VIEW: 'finance:invoices:view',
      CREATE: 'finance:invoices:create',
      EDIT: 'finance:invoices:edit',
      POST: 'finance:invoices:post',
      VOID: 'finance:invoices:void',
    },
    TREASURY: {
      VIEW: 'finance:treasury:view',
      CREATE_ACCOUNT: 'finance:treasury:create_account',
    },
    PAYMENTS: {
      VIEW: 'finance:payments:view',
      CREATE: 'finance:payments:create',
      VOID: 'finance:payments:void',
    },
    RETENTIONS: { VIEW: 'finance:retentions:view' },
    PAYABLES: { VIEW: 'finance:invoices:view' },
    REPORTS: { VIEW: 'finance:reports:view' },
    ACCOUNTS: { VIEW: 'finance:accounts:view', MANAGE: 'finance:accounts:manage' },
    ENTRIES: {
      VIEW: 'finance:entries:view',
      CREATE: 'finance:entries:create',
      POST: 'finance:entries:post',
    },
    CLOSE: { VIEW: 'finance:close:view', MANAGE: 'finance:close:manage' },
  },
  HR: {
    VIEW: 'hr:view',
    EMPLOYEES: {
      VIEW: 'hr:employees:view',
      CREATE: 'hr:employees:create',
      EDIT: 'hr:employees:edit',
      DELETE: 'hr:employees:delete',
    },
    PAYROLL: {
      VIEW: 'hr:payroll:view',
      PROCESS: 'hr:payroll:process',
    },
    INCIDENTS: {
      VIEW: 'hr:incidents:view',
      CREATE: 'hr:incidents:create',
      APPROVE: 'hr:incidents:approve',
    },
    DEPARTMENTS: { MANAGE: 'hr:departments:manage' },
    POSITIONS: { MANAGE: 'hr:positions:manage' },
    SETTINGS: { VIEW: 'hr:settings:view', MANAGE: 'hr:settings:manage' },
    CONCEPTS: { VIEW: 'hr:concepts:view', MANAGE: 'hr:concepts:manage' },
  },
  SETTINGS: {
    VIEW: 'settings:view',
    USERS: {
      VIEW: 'settings:users:view',
      CREATE: 'settings:users:create',
      EDIT: 'settings:users:edit',
      MANAGE: 'settings:users:manage',
    },
    ROLES: { VIEW: 'settings:roles:view', MANAGE: 'settings:roles:manage' },
    COMPANIES: { VIEW: 'settings:companies:view', MANAGE: 'settings:companies:manage' },
    BRANCHES: {
      VIEW: 'settings:branches:view',
      MANAGE: 'settings:branches:manage',
    },
    BANKS: { VIEW: 'settings:banks:view', MANAGE: 'settings:banks:manage' },
    CURRENCIES: { VIEW: 'settings:currencies:view', MANAGE: 'settings:currencies:manage' },
    TAXES: { VIEW: 'settings:taxes:view', MANAGE: 'settings:taxes:manage' },
  },
} as const;

export type PermissionCode = string;
