import { PERMISSIONS } from './permissions';

export type NavLeaf = {
  title: string;
  url: string;
  permission?: string;
  anyPermissions?: string[];
  icon?: string;
};

export type NavGroup = {
  title: string;
  url?: string;
  icon: string;
  permission?: string;
  items?: NavLeaf[];
};

export const NAV_ITEMS: NavGroup[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: 'LayoutDashboard',
    permission: PERMISSIONS.DASHBOARD.VIEW,
  },
  {
    title: 'Operaciones',
    icon: 'Briefcase',
    permission: PERMISSIONS.OPERATIONS.VIEW,
    items: [
      {
        title: 'Clientes y Proveedores',
        url: '/dashboard/operations/partners',
        permission: PERMISSIONS.OPERATIONS.PARTNERS.VIEW,
        icon: 'Users',
      },
      {
        title: 'Ventas',
        url: '/dashboard/operations/sales',
        permission: PERMISSIONS.OPERATIONS.SALES.VIEW,
        icon: 'ShoppingCart',
      },
      {
        title: 'Compras',
        url: '/dashboard/operations/purchases',
        permission: PERMISSIONS.OPERATIONS.PURCHASES.VIEW,
        icon: 'PackageOpen',
      },
      {
        title: 'Pedidos',
        url: '/dashboard/operations/orders',
        permission: PERMISSIONS.OPERATIONS.ORDERS.VIEW,
        icon: 'ClipboardList',
      },
    ],
  },
  {
    title: 'Inventario',
    icon: 'Warehouse',
    permission: PERMISSIONS.INVENTORY.VIEW,
    items: [
      {
        title: 'Productos',
        url: '/dashboard/inventory/products',
        permission: PERMISSIONS.INVENTORY.PRODUCTS.VIEW,
        icon: 'Package',
      },
      {
        title: 'Almacenes',
        url: '/dashboard/inventory/warehouses',
        permission: PERMISSIONS.INVENTORY.WAREHOUSES.VIEW,
        icon: 'Warehouse',
      },
      {
        title: 'Movimientos',
        url: '/dashboard/inventory/moves',
        permission: PERMISSIONS.INVENTORY.MOVES.VIEW,
        icon: 'ArrowLeftRight',
      },
    ],
  },
  {
    title: 'Finanzas',
    icon: 'Banknote',
    permission: PERMISSIONS.FINANCE.VIEW,
    items: [
      {
        title: 'Facturación',
        url: '/dashboard/finance/invoices',
        permission: PERMISSIONS.FINANCE.INVOICES.VIEW,
        icon: 'Receipt',
      },
      {
        title: 'Tesorería',
        url: '/dashboard/finance/treasury',
        permission: PERMISSIONS.FINANCE.TREASURY.VIEW,
        icon: 'Landmark',
      },
      {
        title: 'Cierre diario',
        url: '/dashboard/finance/daily-close',
        permission: PERMISSIONS.FINANCE.VIEW,
        icon: 'CalendarCheck',
      },
      {
        title: 'Retenciones',
        url: '/dashboard/finance/retentions',
        permission: PERMISSIONS.FINANCE.RETENTIONS.VIEW,
        icon: 'FileSpreadsheet',
      },
      {
        title: 'Reportes',
        url: '/dashboard/finance/reports',
        permission: PERMISSIONS.FINANCE.REPORTS.VIEW,
        icon: 'BarChart3',
      },
    ],
  },
  {
    title: 'Recursos Humanos',
    icon: 'Users',
    permission: PERMISSIONS.HR.VIEW,
    items: [
      {
        title: 'Empleados',
        url: '/dashboard/hr/employees',
        permission: PERMISSIONS.HR.EMPLOYEES.VIEW,
        icon: 'UserCircle',
      },
      {
        title: 'Cargos',
        url: '/dashboard/hr/positions',
        permission: PERMISSIONS.HR.VIEW,
        icon: 'Briefcase',
      },
      {
        title: 'Departamentos',
        url: '/dashboard/hr/departments',
        permission: PERMISSIONS.HR.VIEW,
        icon: 'Building2',
      },
      {
        title: 'Nómina',
        url: '/dashboard/hr/payroll',
        permission: PERMISSIONS.HR.PAYROLL.VIEW,
        icon: 'Coins',
      },
      {
        title: 'Parámetros de nómina',
        url: '/dashboard/settings/payroll-settings',
        permission: PERMISSIONS.HR.SETTINGS.VIEW,
        icon: 'SlidersHorizontal',
      },
      {
        title: 'Conceptos de nómina',
        url: '/dashboard/settings/payroll-concepts',
        permission: PERMISSIONS.HR.CONCEPTS.VIEW,
        icon: 'ListTree',
      },
      {
        title: 'Novedades',
        url: '/dashboard/hr/incidents',
        permission: PERMISSIONS.HR.INCIDENTS.VIEW,
        icon: 'AlertCircle',
      },
    ],
  },
  {
    title: 'Configuración',
    icon: 'Settings',
    items: [
      {
        title: 'Usuarios y Roles',
        url: '/dashboard/settings/users',
        permission: PERMISSIONS.SETTINGS.USERS.VIEW,
        icon: 'UserCog',
      },
      {
        title: 'Roles',
        url: '/dashboard/settings/roles',
        permission: PERMISSIONS.SETTINGS.ROLES.VIEW,
        icon: 'Shield',
      },
      {
        title: 'Sucursales',
        url: '/dashboard/settings/branches',
        anyPermissions: [PERMISSIONS.SETTINGS.COMPANIES.VIEW, PERMISSIONS.SETTINGS.BRANCHES.VIEW],
        icon: 'Building',
      },
      {
        title: 'Bancos',
        url: '/dashboard/settings/banks',
        permission: PERMISSIONS.SETTINGS.BANKS.VIEW,
        icon: 'PiggyBank',
      },
      {
        title: 'Monedas',
        url: '/dashboard/settings/currencies',
        permission: PERMISSIONS.SETTINGS.CURRENCIES.VIEW,
        icon: 'CircleDollarSign',
      },
      {
        title: 'Impuestos',
        url: '/dashboard/settings/tax-concepts',
        permission: PERMISSIONS.SETTINGS.TAXES.VIEW,
        icon: 'Percent',
      },
    ],
  },
];
