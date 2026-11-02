import { apiClient } from '@/lib/api/client';

export type AuditChange = Record<string, unknown> | unknown[] | null;

export type AuditResult = 'SUCCESS' | 'DENIED' | 'ERROR';

export type AuditLog = {
  id: string;
  entityTable: string;
  entityId: string | null;
  action: string;
  actionLabel: string | null;
  entityLabel: string | null;
  module: string | null;
  changes: AuditChange;
  branchId: string | null;
  userId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRoles: string[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  httpMethod: string | null;
  route: string | null;
  result: string | null;
  durationMs: number | null;
  documentCode: string | null;
  documentStatus: string | null;
  description: string | null;
  createdAt: string | null;
};

export type AuditLogPage = {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
};

export type AuditFacet = { value: string; label: string; count: number };

export type AuditFacets = {
  actors: Array<{ userId: string | null; name: string; count: number }>;
  modules: AuditFacet[];
  actions: AuditFacet[];
  tables: AuditFacet[];
  results: AuditFacet[];
};

export type AuditFilters = {
  q?: string;
  module?: string;
  result?: string;
  userId?: string;
  entityTable?: string;
  entityId?: string;
  action?: string;
  documentCode?: string;
  from?: string;
  to?: string;
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

export const RESULT_LABELS: Record<string, string> = {
  SUCCESS: 'Éxito',
  DENIED: 'Denegado',
  ERROR: 'Error',
};

/**
 * Etiqueta corta para la columna de la tabla: el verbo completo ("Inició sesión") parte el badge en
 * dos líneas y ensancha la fila. La frase completa vive en `description` y en la ficha.
 */
export const ACTION_SHORT: Record<string, string> = {
  CREATE: 'Alta',
  UPDATE: 'Cambio',
  DELETE: 'Borrado',
  POST: 'Publicación',
  VOID: 'Anulación',
  CANCEL: 'Anulación',
  CONFIRM: 'Confirmación',
  APPROVE: 'Aprobación',
  REJECT: 'Rechazo',
  ADJUST: 'Ajuste',
  RECONCILE: 'Conciliación',
  CLOSE: 'Cierre',
  PAY: 'Pago',
  ASSIGN: 'Asignación',
  LOGIN: 'Ingreso',
  LOGIN_FAILED: 'Ingreso fallido',
  LOGOUT: 'Salida',
  DENIED: 'Denegado',
  EXPORT: 'Exportación',
};

const FIELD_LABEL: Record<string, string> = {
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
  code: 'código',
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

function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? FIELD_LABEL[toCamelCase(field)] ?? field.replace(/_/g, ' ');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Filas legibles de un cambio auditado.
 *
 * El registro guarda el par `{ before, after }`; el visor lo muestra como "campo: antes → después" en
 * lugar de un JSON crudo (`T-07-04`).
 */
export function diffRows(
  changes: AuditChange
): Array<{ field: string; before: string; after: string }> {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];

  const record = changes as Record<string, unknown>;
  const before = (record.before ?? record.from ?? {}) as Record<string, unknown>;
  const after = (record.after ?? record.to ?? record) as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    key => key !== 'before' && key !== 'after' && key !== 'from' && key !== 'to'
  );

  return fields
    .map(field => ({
      field: fieldLabel(field),
      before: formatValue(before[field]),
      after: formatValue(after[field]),
    }))
    .filter(row => row.before !== row.after);
}

function filterParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params;
}

/** Visor de auditoría (`T-07-01`, `T-07-04`). */
export const auditApi = {
  list: (filters: AuditFilters, page = 1, limit = 50) => {
    const params = filterParams(filters);
    params.set('paginated', 'true');
    params.set('page', String(page));
    params.set('limit', String(limit));

    return apiClient.get<AuditLogPage>(`/audit?${params.toString()}`);
  },
  entityTables: () => apiClient.get<string[]>('/audit/entities'),
  facets: () => apiClient.get<AuditFacets>('/audit/facets'),
  exportCsv: (filters: AuditFilters) =>
    apiClient.getText(`/audit/export?${filterParams(filters).toString()}`),
};
