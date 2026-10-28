/**
 * Migas de pan legibles (`H-97`).
 *
 * El breadcrumb se armaba con el segmento crudo de la URL, así que un detalle mostraba
 * `24615290-1b16-4e28-831a-b657f33b121d`. Aquí viven las etiquetas y la regla que reemplaza un
 * identificador por algo que se pueda leer.
 */

const LABELS: Record<string, string> = {
  dashboard: 'Panel',
  bi: 'Indicadores',
  operations: 'Operaciones',
  inventory: 'Inventario',
  finance: 'Finanzas',
  hr: 'Recursos Humanos',
  settings: 'Configuración',

  partners: 'Clientes y Proveedores',
  statement: 'Estado de cuenta',
  sales: 'Ventas',
  purchases: 'Compras',
  orders: 'Pedidos',

  products: 'Productos',
  warehouses: 'Almacenes',
  moves: 'Movimientos',
  stock: 'Stock',

  invoices: 'Facturación',
  payables: 'Cuentas por pagar',
  'credit-notes': 'Notas de crédito',
  loans: 'Préstamos',
  treasury: 'Tesorería',
  accounts: 'Cuentas bancarias',
  reconciliation: 'Conciliación',
  'petty-cash': 'Caja chica',
  'daily-close': 'Cierre diario',
  retentions: 'Retenciones',
  accounting: 'Contabilidad',
  entries: 'Asientos',
  periods: 'Cierre y reportes',
  reports: 'Reportes',

  employees: 'Empleados',
  positions: 'Cargos',
  departments: 'Departamentos',
  payroll: 'Nómina',
  incidents: 'Novedades',

  users: 'Usuarios y Roles',
  roles: 'Roles',
  branches: 'Sucursales',
  banks: 'Bancos',
  methods: 'Métodos de pago',
  currencies: 'Monedas',
  'tax-concepts': 'Impuestos',
  'payroll-settings': 'Parámetros de nómina',
  'payroll-concepts': 'Conceptos de nómina',
  audit: 'Auditoría',
};

/** Etiqueta de un identificador cuando no hay un nombre que mostrar. */
export const DETAIL_LABEL = 'Detalle';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{16,}$/i;
const NUMERIC = /^\d+$/;

/** `true` si el segmento es un identificador y no una sección de la aplicación. */
export function isIdentifierSegment(segment: string): boolean {
  return UUID.test(segment) || LONG_HEX.test(segment) || NUMERIC.test(segment);
}

export function labelForSegment(segment: string): string {
  return LABELS[segment] ?? decodeURIComponent(segment).replace(/-/g, ' ');
}

export type Crumb = { slug: string; href: string; label: string; isIdentifier: boolean };

/**
 * Construye las migas de una ruta.
 *
 * `names` permite dar un nombre al identificador cuando la página ya lo conoce (por ejemplo el
 * código de la nómina); si no viene, el segmento se muestra como `Detalle`.
 */
export function buildCrumbs(pathname: string, names: Record<string, string> = {}): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);

  return segments.map((segment, index) => {
    const isIdentifier = isIdentifierSegment(segment);
    const label = isIdentifier ? (names[segment] ?? DETAIL_LABEL) : labelForSegment(segment);

    return {
      slug: segment,
      href: '/' + segments.slice(0, index + 1).join('/'),
      label,
      isIdentifier,
    };
  });
}
