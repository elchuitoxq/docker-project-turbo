import { apiClient } from '@/lib/api/client';

export type AuditChange = Record<string, unknown> | unknown[] | null;

export type AuditLog = {
  id: string;
  entityTable: string;
  entityId: string;
  action: string;
  changes: AuditChange;
  branchId: string | null;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
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

export type AuditFilters = {
  entityTable?: string;
  entityId?: string;
  action?: string;
  documentCode?: string;
  userId?: string;
  from?: string;
  to?: string;
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
  reference: 'referencia',
};

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
      field: FIELD_LABEL[field] ?? field,
      before: formatValue(before[field]),
      after: formatValue(after[field]),
    }))
    .filter(row => row.before !== row.after);
}

/** Visor de auditoría (`T-07-01`, `T-07-04`). */
export const auditApi = {
  list: (filters: AuditFilters, page = 1, limit = 50) => {
    const params = new URLSearchParams({
      paginated: 'true',
      page: String(page),
      limit: String(limit),
    });
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }

    return apiClient.get<AuditLogPage>(`/audit?${params.toString()}`);
  },
  entityTables: () => apiClient.get<string[]>('/audit/entities'),
};
