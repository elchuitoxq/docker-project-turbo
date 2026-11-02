/**
 * Un paso del histórico de procesos (`S-12`): quién, cuándo y qué transición de estado.
 *
 * El backend ya resuelve el nombre del usuario; la UI no cruza catálogos.
 */
export type DocumentEvent = {
  id: string;
  documentType: 'ORDER' | 'INVOICE';
  documentId: string;
  documentCode: string | null;
  parentDocumentId: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  userName: string | null;
  createdAt: string | null;
};

/** Línea de documento (factura o pedido), en la moneda del documento. */
export type DocumentLine = {
  id: string;
  productId: string;
  productSku?: string | null;
  productName?: string | null;
  quantity: number;
  price: number;
  taxRate?: number | string | null;
  total: number;
};

/** Pago aplicado al documento. */
export type DocumentPayment = {
  id: string;
  code: string;
  date?: string | null;
  amount: number;
  currencyCode: string | null;
  exchangeRate?: number | null;
  /** Referencia bancaria de la transacción: es la prueba de que el dinero entró. */
  reference?: string | null;
  status: string | null;
};

export type DocumentCreditNote = {
  id: string;
  code: string;
  total: number;
  status: string | null;
};

export type DocumentRetention = {
  id: string;
  code: string;
  type: string;
  totalBase: number;
  totalRetained: number;
  voucherNumber?: string | null;
  date?: string | null;
};

/**
 * Saldo del documento **en su propia moneda** (`summarizeBalance` del backend).
 *
 * El equivalente en moneda funcional se calcula con el `exchangeRate` del documento: nunca con la
 * tasa de hoy.
 */
export type DocumentSettlement = {
  total: number;
  paid: number;
  credited: number;
  retained: number;
  settled: number;
  balance: number;
};

export type InvoiceDocumentDetail = {
  id: string;
  code: string;
  partnerId: string;
  partnerName?: string | null;
  type: 'SALE' | 'PURCHASE' | string;
  status: string | null;
  fiscalStatus?: string | null;
  invoiceNumber?: string | null;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceDate?: string | null;
  branchId: string;
  branchName?: string | null;
  warehouseName?: string | null;
  currencyId: string;
  currencyCode?: string | null;
  exchangeRate?: number | string | null;
  totalBase: number;
  totalTax: number;
  totalIgtf: number;
  total: number;
  /** Fecha de emisión (`invoices.date`). */
  date?: string | null;
  dueDate?: string | null;
  daysOverdue?: number;
  orderId?: string | null;
  orderCode?: string | null;
  createdByName?: string | null;
  settlement?: DocumentSettlement;
  payments?: DocumentPayment[];
  creditNotes?: DocumentCreditNote[];
  retentions?: DocumentRetention[];
  /** Histórico de procesos de la factura y de su pedido de origen (`S-12`). */
  history?: DocumentEvent[];
  items?: DocumentLine[];
};

export type OrderDocumentDetail = {
  id: string;
  code: string;
  partnerId: string;
  partnerName?: string | null;
  partnerTaxId?: string | null;
  type: 'SALE' | 'PURCHASE';
  status: string;
  total: number;
  exchangeRate: number | null;
  currencyId: string | null;
  currencyCode?: string | null;
  branchName?: string | null;
  warehouseName?: string | null;
  createdByName?: string | null;
  date?: string | null;
  invoiceId?: string | null;
  invoiceCode?: string | null;
  invoiceStatus?: string | null;
  /** Histórico de procesos del pedido y de su factura (`S-12`). */
  history?: DocumentEvent[];
  items?: DocumentLine[];
};
