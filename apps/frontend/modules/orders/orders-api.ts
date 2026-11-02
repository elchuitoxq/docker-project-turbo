import { apiClient } from '@/lib/api/client';
import type { DocumentEvent, OrderDocumentDetail } from '@/modules/documents/types';

/** Estados que expone el backend (`OrderStatus` del módulo orders). */
export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export type Order = {
  id: string;
  code: string;
  partnerId: string;
  partnerName?: string | null;
  type: 'SALE' | 'PURCHASE';
  status: OrderStatus;
  total: string;
  currencyId: string | null;
  exchangeRate: number;
  orderDate: string;
  deliveryDate: string | null;
  notes?: string;
};

type RawOrder = {
  id: string;
  code: string;
  partnerId: string;
  partnerName?: string | null;
  type?: 'SALE' | 'PURCHASE';
  status?: string;
  total?: number | string;
  currencyId?: string | null;
  exchangeRate?: number | string | null;
  date?: string;
  createdAt?: string;
};

/** Cuerpo de `POST /v1/orders`: el código lo genera la UI porque el pedido no tiene secuencia propia. */
export type OrderPayload = {
  code: string;
  partnerId: string;
  warehouseId?: string;
  type: 'SALE' | 'PURCHASE';
  currencyId?: string;
  exchangeRate?: number;
  date?: string;
  items: { productId: string; quantity: number; price: number }[];
};

function buildQuery(filters: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** El backend devuelve `date` y un `total` numérico; la vista trabaja con `orderDate`/string. */
function normalize(raw: RawOrder): Order {
  return {
    id: raw.id,
    code: raw.code,
    partnerId: raw.partnerId,
    partnerName: raw.partnerName ?? null,
    type: raw.type ?? 'SALE',
    status: (raw.status as OrderStatus) ?? 'DRAFT',
    total: String(raw.total ?? 0),
    // Sin `currencyCode` en el contrato: la moneda se resuelve con el catálogo por `currencyId`,
    // nunca asumiendo USD.
    currencyId: raw.currencyId ?? null,
    exchangeRate:
      raw.exchangeRate === undefined || raw.exchangeRate === null ? 1 : Number(raw.exchangeRate),
    orderDate: raw.date ?? raw.createdAt ?? '',
    deliveryDate: null,
  };
}

type RawOrderDetail = RawOrder & {
  branchName?: string | null;
  warehouseName?: string | null;
  partnerTaxId?: string | null;
  createdByName?: string | null;
  invoiceId?: string | null;
  invoiceCode?: string | null;
  invoiceStatus?: string | null;
  history?: DocumentEvent[];
  items?: {
    id: string;
    productId: string;
    productSku?: string | null;
    productName?: string | null;
    quantity?: number | string;
    price?: number | string;
  }[];
};

/** El detalle del pedido no trae `total` por línea: se calcula con cantidad × precio. */
function normalizeDetail(raw: RawOrderDetail): OrderDocumentDetail {
  return {
    id: raw.id,
    code: raw.code,
    partnerId: raw.partnerId,
    partnerName: raw.partnerName ?? null,
    partnerTaxId: raw.partnerTaxId ?? null,
    type: raw.type ?? 'SALE',
    status: (raw.status as OrderStatus) ?? 'DRAFT',
    total: Number(raw.total ?? 0),
    exchangeRate:
      raw.exchangeRate === undefined || raw.exchangeRate === null ? null : Number(raw.exchangeRate),
    currencyId: raw.currencyId ?? null,
    branchName: raw.branchName ?? null,
    warehouseName: raw.warehouseName ?? null,
    createdByName: raw.createdByName ?? null,
    date: raw.date ?? raw.createdAt ?? null,
    invoiceId: raw.invoiceId ?? null,
    invoiceCode: raw.invoiceCode ?? null,
    invoiceStatus: raw.invoiceStatus ?? null,
    history: raw.history ?? [],
    items: (raw.items ?? []).map(item => {
      const quantity = Number(item.quantity ?? 0);
      const price = Number(item.price ?? 0);
      return {
        id: item.id,
        productId: item.productId,
        productSku: item.productSku ?? null,
        productName: item.productName ?? null,
        quantity,
        price,
        total: quantity * price,
      };
    }),
  };
}

export const ordersApi = {
  /**
   * El listado del backend responde un arreglo plano; se normaliza a la forma paginada que
   * consumen las vistas (mismo patrón que `partnersApi.list`).
   */
  list: async (
    filters: { type?: 'SALE' | 'PURCHASE'; status?: string; page?: number; limit?: number } = {}
  ) => {
    const response = await apiClient.get<
      RawOrder[] | { data: RawOrder[]; total: number; page: number; limit: number }
    >(`/orders${buildQuery(filters)}`);

    const rows = Array.isArray(response) ? response : (response.data ?? []);
    const orders = rows
      .map(normalize)
      .filter(order => !filters.type || order.type === filters.type)
      .filter(order => !filters.status || order.status === filters.status);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? Math.max(orders.length, 1);
    const start = (page - 1) * limit;

    return {
      data: orders.slice(start, start + limit),
      total: orders.length,
      page,
      limit,
    };
  },
  get: (id: string) => apiClient.get<RawOrder>(`/orders/${id}`),
  /** Alta de pedido (`T-09-15`): devuelve el pedido creado para abrir su ficha. */
  create: (payload: OrderPayload) => apiClient.post<RawOrder>('/orders', payload),
  /**
   * Corrección de un pedido. La tasa sólo se acepta mientras la factura del pedido no esté emitida
   * (lo valida el backend); las líneas se reemplazan completas.
   */
  update: (
    id: string,
    payload: {
      currencyId?: string;
      exchangeRate?: number;
      items?: { productId: string; quantity: number; price: number }[];
    }
  ) => apiClient.patch<RawOrder>(`/orders/${id}`, payload),
  /** Ficha del pedido (`S-10`): tercero, almacén, SKU, autor y factura asociada. */
  getDetail: async (id: string) =>
    normalizeDetail(await apiClient.get<RawOrderDetail>(`/orders/${id}`)),
  confirm: (id: string) =>
    apiClient.post<{ id: string; status: string }>(`/orders/${id}/confirm`, {}),
  cancel: (id: string) =>
    apiClient.post<{ id: string; status: string }>(`/orders/${id}/cancel`, {}),
  invoice: (id: string) =>
    apiClient.post<{ invoiceId: string; invoiceCode: string }>(`/orders/${id}/invoice`, {}),
};
