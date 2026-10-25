export type ProductType = 'PHYSICAL' | 'SERVICE' | 'DIGITAL';

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  cost: string;
  price: string;
  isExempt: boolean;
  taxRate: string;
  type: ProductType;
  minStock: string;
  hasBatches: boolean;
  currencyId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductCategory = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
};

export type ProductFilters = {
  page?: number;
  limit?: number;
  type?: ProductType;
  search?: string;
  categoryId?: string;
};
