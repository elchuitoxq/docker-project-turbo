import { apiClient } from '@/lib/api/client';

export type MoveType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
export type MoveStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type Move = {
  id: string;
  code: string;
  type: MoveType;
  status: MoveStatus;
  productId: string;
  productName?: string;
  productSku?: string;
  warehouseId: string;
  warehouseName?: string;
  warehouseDestId?: string | null;
  warehouseDestName?: string | null;
  quantity: string;
  unitCost: string;
  totalCost: string;
  reason?: string;
  /** Motivo del ajuste (`S-25`). */
  reasonCode?: string | null;
  /** El ajuste se sale de la tolerancia y no lo puede aprobar quien lo registró. */
  requiresSecondApproval?: boolean;
  /** La salida despachó un lote posterior al sugerido por FEFO (`S-26`). */
  fefoOverride?: boolean;
  fefoOverrideReason?: string | null;
  date: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
};

/**
 * Motivos de ajuste (`S-25`). Sin motivo el backend rechaza el ajuste: es la trazabilidad mínima que
 * se le exige a un inventario físico.
 */
export const ADJUSTMENT_REASONS: { value: string; label: string }[] = [
  { value: 'CONTEO', label: 'Diferencia de conteo físico' },
  { value: 'DAÑO', label: 'Mercancía dañada' },
  { value: 'VENCIMIENTO', label: 'Mercancía vencida' },
  { value: 'HURTO', label: 'Pérdida o hurto' },
  { value: 'ERROR_DIGITACION', label: 'Error de digitación' },
];

function buildQuery(filters: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Forma cruda que devuelve el backend (vocabulario `ENTRADA/EN_TRAMITE`). */
type RawMove = {
  id: string;
  code: string;
  type?: string;
  status?: string;
  productId?: string | null;
  productName?: string | null;
  productSku?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  warehouseDestId?: string | null;
  warehouseDestName?: string | null;
  quantity?: string | null;
  unitCost?: string | null;
  totalCost?: string | null;
  rejectionReason?: string | null;
  reasonCode?: string | null;
  requiresSecondApproval?: boolean | null;
  fefoOverride?: boolean | null;
  fefoOverrideReason?: string | null;
  date?: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
};

const TYPE_FROM_API: Record<string, MoveType> = {
  ENTRADA: 'IN',
  SALIDA: 'OUT',
  TRANSFERENCIA: 'TRANSFER',
  AJUSTE: 'ADJUSTMENT',
  IN: 'IN',
  OUT: 'OUT',
  TRANSFER: 'TRANSFER',
  ADJUSTMENT: 'ADJUSTMENT',
};

const STATUS_FROM_API: Record<string, MoveStatus> = {
  EN_TRAMITE: 'DRAFT',
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

function normalizeMove(raw: RawMove): Move {
  return {
    id: raw.id,
    code: raw.code,
    type: TYPE_FROM_API[raw.type ?? ''] ?? 'TRANSFER',
    status: STATUS_FROM_API[raw.status ?? ''] ?? 'DRAFT',
    productId: raw.productId ?? '',
    productName: raw.productName ?? undefined,
    productSku: raw.productSku ?? undefined,
    warehouseId: raw.warehouseId ?? '',
    warehouseName: raw.warehouseName ?? undefined,
    warehouseDestId: raw.warehouseDestId ?? null,
    warehouseDestName: raw.warehouseDestName ?? null,
    quantity: raw.quantity ?? '0',
    unitCost: raw.unitCost ?? '0',
    totalCost: raw.totalCost ?? '0',
    reason: raw.rejectionReason ?? undefined,
    reasonCode: raw.reasonCode ?? null,
    requiresSecondApproval: raw.requiresSecondApproval ?? false,
    fefoOverride: raw.fefoOverride ?? false,
    fefoOverrideReason: raw.fefoOverrideReason ?? null,
    date: raw.date ?? '',
    approvedAt: raw.approvedAt ?? null,
    approvedBy: raw.approvedBy ?? null,
  };
}

/**
 * Movimiento tal como lo captura la UI.
 *
 * `quantity` es la cantidad movida (entrada/salida/transferencia) o la **cantidad contada** en un
 * ajuste: en el ajuste el backend deja el stock en ese número.
 */
export type CreateMovePayload = {
  type: MoveType;
  /** Almacén de destino en una entrada. */
  toWarehouseId?: string;
  /** Almacén de origen en salida y transferencia; almacén ajustado en un ajuste. */
  fromWarehouseId?: string;
  /** Obligatorio en un ajuste (`S-25`). */
  reasonCode?: string;
  /** Autoriza despachar un lote posterior al sugerido por FEFO (`S-26`). */
  fefoOverride?: boolean;
  fefoOverrideReason?: string;
  note?: string;
  lines: {
    productId: string;
    quantity: number;
    cost?: number;
    /** Lote existente (el que sugiere el FEFO). */
    batchId?: string;
    /** Lote nuevo: en la recepción el backend lo crea si no existe. */
    batchNumber?: string;
    /** Vencimiento del lote cuando se crea. */
    batchExpirationDate?: string;
  }[];
};

const TYPE_TO_API: Record<MoveType, string> = {
  IN: 'ENTRADA',
  OUT: 'SALIDA',
  TRANSFER: 'TRANSFERENCIA',
  ADJUSTMENT: 'AJUSTE',
};

function toApiPayload(data: CreateMovePayload) {
  return {
    type: TYPE_TO_API[data.type],
    // La entrada sólo lleva destino; salida y ajuste sólo origen; la transferencia, ambos.
    ...(data.type === 'IN' ? { toWarehouseId: data.toWarehouseId } : {}),
    ...(data.type !== 'IN' ? { fromWarehouseId: data.fromWarehouseId } : {}),
    ...(data.type === 'TRANSFER' ? { toWarehouseId: data.toWarehouseId } : {}),
    ...(data.reasonCode ? { reasonCode: data.reasonCode } : {}),
    ...(data.fefoOverride
      ? { fefoOverride: true, fefoOverrideReason: data.fefoOverrideReason?.trim() }
      : {}),
    note: data.note?.trim() || undefined,
    lines: data.lines.map(line => ({
      productId: line.productId,
      quantity: String(line.quantity),
      ...(line.cost !== undefined ? { cost: String(line.cost) } : {}),
      ...(line.batchId ? { batchId: line.batchId } : {}),
      ...(line.batchNumber ? { batchNumber: line.batchNumber } : {}),
      ...(line.batchExpirationDate ? { batchExpirationDate: line.batchExpirationDate } : {}),
    })),
  };
}

export const movesApi = {
  /**
   * El backend usa `ENTRADA/SALIDA/TRANSFERENCIA/AJUSTE` y `EN_TRAMITE`; la UI trabaja con
   * `IN/OUT/TRANSFER/ADJUSTMENT` y `DRAFT`. Se normaliza aquí para que etiquetas, contadores y
   * filtros coincidan (antes los badges salían vacíos y los totales en cero).
   */
  list: async (
    filters: {
      type?: MoveType;
      status?: MoveStatus;
      warehouseId?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const response = await apiClient.get<
      RawMove[] | { data: RawMove[]; total: number; page: number; limit: number }
    >(`/inventory/moves${buildQuery({ warehouseId: filters.warehouseId })}`);

    const rows = (Array.isArray(response) ? response : (response.data ?? [])).map(normalizeMove);
    const filtered = rows
      .filter(move => !filters.type || move.type === filters.type)
      .filter(move => !filters.status || move.status === filters.status);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? Math.max(filtered.length, 1);
    const start = (page - 1) * limit;

    return {
      data: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
    };
  },
  get: async (id: string) => normalizeMove(await apiClient.get<RawMove>(`/inventory/moves/${id}`)),

  /**
   * Crea un movimiento con el vocabulario del backend.
   *
   * La UI habla `IN/OUT/TRANSFER/ADJUSTMENT` y el API espera `ENTRADA/SALIDA/TRANSFERENCIA/AJUSTE`,
   * más `toWarehouseId` para la entrada y `fromWarehouseId` para la salida y el ajuste. Antes se
   * enviaba el objeto de la UI tal cual y el backend respondía `400 type must be one of ...`.
   */
  create: (data: CreateMovePayload) =>
    apiClient.post<RawMove>('/inventory/moves', toApiPayload(data)),
  approve: (id: string) => apiClient.post<RawMove>(`/inventory/moves/${id}/approve`, {}),

  /**
   * Aprobación en lote (`S-25`).
   *
   * El backend procesa documento por documento y devuelve los que fallaron con su motivo: un
   * movimiento inválido no revierte los ya aprobados.
   */
  approveBatch: (ids: string[]) =>
    apiClient.post<{ approved: string[]; failed: { id: string; message: string }[] }>(
      '/inventory/moves/approve-batch',
      { ids }
    ),

  /**
   * La API no tiene `cancel`: el equivalente es `reject`, que **exige motivo**. Sin él respondía
   * `400 reason must be a string` y el botón "Cancelar" no hacía nada.
   */
  cancel: (id: string, reason = 'Cancelado desde el listado') =>
    apiClient.post<RawMove>(`/inventory/moves/${id}/reject`, { reason }),
};
