export type PartnerType = 'CUSTOMER' | 'VENDOR';
export type TaxpayerType = 'ORDINARY' | 'SPECIAL';

export type Partner = {
  id: string;
  name: string;
  email: string | null;
  taxId: string;
  address: string | null;
  phone: string | null;
  type: PartnerType;
  taxpayerType: TaxpayerType;
  retentionRate: string;
  isSpecialTaxpayer: boolean;
  creditLimit: string;
  islrConceptId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerFilters = {
  page?: number;
  limit?: number;
  type?: PartnerType;
  search?: string;
};

export type PartnerStatement = {
  partnerId: string;
  partnerName: string;
  partnerTaxId: string;
  totalPaid: number;
  totalOutstanding: number;
  creditBalance: number;
  recentPayments: Array<{
    id: string;
    code: string;
    date: string | null;
    amount: number;
    type: string | null;
  }>;
  outstandingInvoices: Array<{
    id: string;
    code: string;
    date: string | null;
    total: number;
    paid: number;
    pending: number;
  }>;
};
