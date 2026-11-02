/**
 * Catálogo de lo que se audita.
 *
 * El interceptor no adivina el módulo ni el nombre de la entidad: los lee de aquí. Cada entrada
 * declara la tabla real (para leer el antes/después), el módulo con el que el visor agrupa y el
 * nombre con el que se describe el hecho.
 */
export interface AuditTarget {
  table: string;
  module: string;
  label: string;
}

export const AUDIT_TARGETS: Record<string, AuditTarget> = {
  invoices: { table: 'invoices', module: 'billing', label: 'factura' },
  'credit-notes': { table: 'credit_notes', module: 'billing', label: 'nota de crédito' },
  retentions: { table: 'tax_retentions', module: 'billing', label: 'retención' },
  payments: { table: 'payments', module: 'treasury', label: 'pago' },
  moves: { table: 'inventory_moves', module: 'inventory', label: 'movimiento de inventario' },
  warehouses: { table: 'warehouses', module: 'inventory', label: 'almacén' },
  products: { table: 'products', module: 'inventory', label: 'producto' },
  payroll: { table: 'payroll_runs', module: 'hr', label: 'corrida de nómina' },
  employees: { table: 'employees', module: 'hr', label: 'empleado' },
  loans: { table: 'loans', module: 'operations', label: 'préstamo' },
  entries: { table: 'accounting_entries', module: 'accounting', label: 'asiento contable' },
  partners: { table: 'partners', module: 'operations', label: 'tercero' },
  orders: { table: 'orders', module: 'operations', label: 'pedido' },
  users: { table: 'users', module: 'settings', label: 'usuario' },
  roles: { table: 'roles', module: 'settings', label: 'rol' },
  branches: { table: 'branches', module: 'settings', label: 'sucursal' },
};

/** Verbo conjugado (tercera persona, pasado) por acción. */
export const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creó',
  UPDATE: 'Modificó',
  DELETE: 'Eliminó',
  POST: 'Publicó',
  VOID: 'Anuló',
  CANCEL: 'Canceló',
  CONFIRM: 'Confirmó',
  APPROVE: 'Aprobó',
  REJECT: 'Rechazó',
  ADJUST: 'Ajustó',
  RECONCILE: 'Concilió',
  CLOSE: 'Cerró',
  PAY: 'Pagó',
  ASSIGN: 'Asignó',
  LOGIN: 'Inició sesión',
  LOGIN_FAILED: 'Intentó iniciar sesión',
  LOGOUT: 'Cerró sesión',
  DENIED: 'Intentó una acción sin permiso',
  EXPORT: 'Exportó',
};

export const MODULE_LABELS: Record<string, string> = {
  billing: 'Facturación',
  treasury: 'Tesorería',
  inventory: 'Inventario',
  operations: 'Operaciones',
  hr: 'Nómina',
  accounting: 'Contabilidad',
  settings: 'Configuración',
  auth: 'Seguridad',
};

export function actionVerb(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const ARTICLES: Record<string, string> = { sucursal: 'la' };

/** Artículo del nombre de la entidad ("la factura", "el pago") para que la frase se lea natural. */
export function entityArticle(label: string): string {
  const first = label.split(' ')[0];
  const explicit = ARTICLES[first];
  if (explicit) return explicit;
  if (first.endsWith('a') || first.endsWith('ión') || first.endsWith('ad')) return 'la';
  return 'el';
}

export function moduleLabel(module: string | null | undefined): string {
  if (!module) return '—';
  return MODULE_LABELS[module] ?? module;
}

/** Etiquetas de campo para el resumen legible ("estado: DRAFT → POSTED"). */
const FIELD_LABELS: Record<string, string> = {
  status: 'estado',
  total: 'total',
  totalBase: 'base',
  totalTax: 'IVA',
  paidAmount: 'pagado',
  dueDate: 'vencimiento',
  amount: 'monto',
  balance: 'saldo',
  isActive: 'activo',
  name: 'nombre',
  email: 'correo',
  reference: 'referencia',
  quantity: 'cantidad',
  cost: 'costo',
  price: 'precio',
  currencyId: 'moneda',
  exchangeRate: 'tasa',
  taxId: 'RIF',
  type: 'tipo',
  phone: 'teléfono',
  address: 'dirección',
  notes: 'notas',
  creditDays: 'días de crédito',
  creditLimit: 'límite de crédito',
};

function toCamelCase(field: string): string {
  return field.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Acepta `taxId` y `tax_id`: el diff puede venir de la fila cruda de Postgres o del cuerpo DTO. */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? FIELD_LABELS[toCamelCase(field)] ?? field.replace(/_/g, ' ');
}
