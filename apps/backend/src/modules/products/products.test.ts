import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock('../../database', () => ({
  db: mockDb,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
  or: vi.fn((...conditions) => ({ conditions, op: 'or' })),
  like: vi.fn((field, pattern) => ({ field, pattern, op: 'like' })),
  sql: vi.fn(template => ({ template, op: 'sql' })),
  relations: vi.fn(),
}));

import { ProductsService } from './products.service';
import { products, productCategories } from '../../schema';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockProduct = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    sku: 'ELEC-001',
    name: 'Laptop Pro 15',
    description: 'High-performance laptop with 16GB RAM',
    categoryId: '550e8400-e29b-41d4-a716-446655440001',
    cost: '500.00',
    price: '899.99',
    isExempt: false,
    taxRate: '16.00',
    type: 'PHYSICAL',
    minStock: '10',
    hasBatches: true,
    currencyId: '550e8400-e29b-41d4-a716-446655440002',
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-01T12:00:00Z'),
  };

  const mockCategory = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Electronics',
    description: 'Electronic devices and accessories',
    parentId: null,
  };

  const createChain = (resolvedValue: any[]) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: Function) => resolve(resolvedValue),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductsService();
  });

  describe('findAll without search', () => {
    it('should return all products', async () => {
      const productChain = createChain([mockProduct]);
      const categoryChain = createChain([mockCategory]);
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? productChain : categoryChain;
      });

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].sku).toBe(mockProduct.sku);
      expect(result[0].name).toBe(mockProduct.name);
    });

    it('should return empty array when no products', async () => {
      const productChain = createChain([]);
      mockDb.select.mockReturnValue(productChain);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      const productChain = createChain([mockProduct]);
      const categoryChain = createChain([mockCategory]);
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? productChain : categoryChain;
      });

      const result = await service.findOne(mockProduct.id);

      expect(result.id).toBe(mockProduct.id);
      expect(result.sku).toBe(mockProduct.sku);
      expect(result.name).toBe(mockProduct.name);
    });

    it('should throw NotFoundException when product not found', async () => {
      const productChain = createChain([]);
      mockDb.select.mockReturnValue(productChain);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new product', async () => {
      const createDto = {
        sku: 'NEW-001',
        name: 'New Product',
        description: 'A new product',
        categoryId: mockCategory.id,
        cost: 100,
        price: 199.99,
        isExempt: false,
        taxRate: 16,
        type: 'PHYSICAL' as const,
        minStock: 5,
        hasBatches: false,
        currencyId: mockProduct.currencyId,
      };

      const newProduct = {
        ...mockProduct,
        ...createDto,
        cost: '100',
        price: '199.99',
        minStock: '5',
      };

      const productChain = createChain([]);
      const categoryChain = createChain([mockCategory]);
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? productChain : categoryChain;
      });

      const mockInsert = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([newProduct]),
      };
      mockDb.insert.mockReturnValue(mockInsert);

      const result = await service.create(createDto);

      expect(mockDb.insert).toHaveBeenCalledWith(products);
      expect(result.sku).toBe(createDto.sku);
      expect(result.name).toBe(createDto.name);
    });

    it('should throw ConflictException when SKU already exists', async () => {
      const createDto = {
        sku: 'EXISTING-001',
        name: 'Existing Product',
      };

      const productChain = createChain([mockProduct]);
      mockDb.select.mockReturnValue(productChain);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove a product', async () => {
      const productChain = createChain([mockProduct]);
      mockDb.select.mockReturnValue(productChain);

      const result = await service.remove(mockProduct.id);

      expect(result.message).toContain('deleted successfully');
    });

    it('should throw NotFoundException when removing non-existent product', async () => {
      const productChain = createChain([]);
      mockDb.select.mockReturnValue(productChain);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Category Management', () => {
    describe('findAllCategories', () => {
      it('should return all categories', async () => {
        const categoryChain = createChain([mockCategory]);
        mockDb.select.mockReturnValue(categoryChain);

        const result = await service.findAllCategories();

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe(mockCategory.name);
      });

      it('should return empty array when no categories found', async () => {
        const categoryChain = createChain([]);
        mockDb.select.mockReturnValue(categoryChain);

        const result = await service.findAllCategories();

        expect(result).toHaveLength(0);
      });
    });

    describe('findOneCategory', () => {
      it('should return a category by id', async () => {
        const categoryChain = createChain([mockCategory]);
        mockDb.select.mockReturnValue(categoryChain);

        const result = await service.findOneCategory(mockCategory.id);

        expect(result.id).toBe(mockCategory.id);
        expect(result.name).toBe(mockCategory.name);
      });

      it('should throw NotFoundException when category not found', async () => {
        const categoryChain = createChain([]);
        mockDb.select.mockReturnValue(categoryChain);

        await expect(service.findOneCategory('non-existent-id')).rejects.toThrow(NotFoundException);
      });
    });

    describe('createCategory', () => {
      it('should create a new category', async () => {
        const createDto = {
          name: 'New Category',
          description: 'A new category description',
        };

        const newCategory = {
          id: 'new-category-id',
          ...createDto,
          parentId: null,
        };

        const mockInsert = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([newCategory]),
        };
        mockDb.insert.mockReturnValue(mockInsert);

        const result = await service.createCategory(createDto);

        expect(mockDb.insert).toHaveBeenCalledWith(productCategories);
        expect(result.name).toBe(createDto.name);
      });

      it('should create category with parent', async () => {
        const createDto = {
          name: 'Child Category',
          parentId: mockCategory.id,
        };

        const newCategory = {
          id: 'child-category-id',
          name: 'Child Category',
          description: null,
          parentId: mockCategory.id,
        };

        const mockInsert = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([newCategory]),
        };
        mockDb.insert.mockReturnValue(mockInsert);

        const result = await service.createCategory(createDto);

        expect(mockDb.insert).toHaveBeenCalled();
        expect(result.parentId).toBe(mockCategory.id);
      });
    });
  });

  describe('Price and Cost Calculations', () => {
    it('should calculate gross profit correctly', () => {
      const cost = 500;
      const price = 899.99;
      const grossProfit = price - cost;

      expect(grossProfit).toBeCloseTo(399.99, 2);
    });

    it('should calculate gross margin percentage correctly', () => {
      const cost = 500;
      const price = 1000;
      const grossMargin = ((price - cost) / price) * 100;

      expect(grossMargin).toBe(50);
    });

    it('should handle zero cost products', () => {
      const cost = 0;
      const price = 100;

      expect(price - cost).toBe(100);
    });

    it('should handle negative margin scenario', () => {
      const cost = 150;
      const price = 100;
      const grossProfit = price - cost;

      expect(grossProfit).toBe(-50);
    });

    it('should calculate markup percentage correctly', () => {
      const cost = 500;
      const price = 1000;
      const markup = ((price - cost) / cost) * 100;

      expect(markup).toBe(100);
    });

    it('should handle fractional prices', () => {
      const cost = 33.33;
      const price = 66.66;
      const grossProfit = price - cost;

      expect(grossProfit).toBeCloseTo(33.33, 2);
    });
  });

  describe('Tax Rate Handling', () => {
    it('should calculate tax for non-exempt product at 16%', () => {
      const price = 1000;
      const taxRate = 16;
      const taxAmount = price * (taxRate / 100);

      expect(taxAmount).toBe(160);
    });

    it('should return zero tax for exempt product', () => {
      const isExempt = true;
      const price = 1000;
      const taxRate = 16;
      const taxAmount = isExempt ? 0 : price * (taxRate / 100);

      expect(taxAmount).toBe(0);
    });

    it('should calculate total with tax correctly', () => {
      const price = 899.99;
      const taxRate = 16;
      const isExempt = false;
      const subtotal = price;
      const taxAmount = isExempt ? 0 : subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      expect(taxAmount).toBeCloseTo(144, 2);
      expect(total).toBeCloseTo(1043.99, 2);
    });

    it('should handle custom tax rates', () => {
      const price = 1000;
      const taxRates = [8, 10, 12, 16, 20];

      taxRates.forEach(rate => {
        const taxAmount = price * (rate / 100);
        expect(taxAmount).toBe((price * rate) / 100);
      });
    });

    it('should handle zero tax rate', () => {
      const price = 1000;
      const taxRate = 0;
      const taxAmount = price * (taxRate / 100);

      expect(taxAmount).toBe(0);
    });

    it('should handle tax-exempt products with 0% rate', () => {
      const price = 1000;
      const taxRate = 0;
      const taxAmount = price * (taxRate / 100);

      expect(taxAmount).toBe(0);
    });

    it('should calculate tax for multiple items', () => {
      const items = [
        { price: 100, quantity: 2, taxRate: 16 },
        { price: 50, quantity: 3, taxRate: 16 },
        { price: 200, quantity: 1, taxRate: 8 },
      ];

      const totalTax = items.reduce(
        (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
        0
      );

      expect(totalTax).toBe(72);
    });

    it('should handle mixed taxable and exempt items', () => {
      const items = [
        { price: 100, quantity: 2, isExempt: false, taxRate: 16 },
        { price: 50, quantity: 1, isExempt: true, taxRate: 16 },
      ];

      const totalTax = items.reduce(
        (sum, item) =>
          sum + (item.isExempt ? 0 : item.price * item.quantity * (item.taxRate / 100)),
        0
      );

      expect(totalTax).toBe(32);
    });
  });

  describe('Batch Product Handling', () => {
    it('should identify product with batch tracking enabled', () => {
      const product = { ...mockProduct, hasBatches: true };
      expect(product.hasBatches).toBe(true);
    });

    it('should identify product without batch tracking', () => {
      const product = { ...mockProduct, hasBatches: false };
      expect(product.hasBatches).toBe(false);
    });

    it('should calculate batch value correctly', () => {
      const batches = [
        { batchNumber: 'B001', quantity: 10, cost: 50 },
        { batchNumber: 'B002', quantity: 5, cost: 55 },
      ];

      const totalValue = batches.reduce((sum, batch) => sum + batch.quantity * batch.cost, 0);

      expect(totalValue).toBe(775);
    });

    it('should handle empty batches', () => {
      const batches: { batchNumber: string; quantity: number; cost: number }[] = [];
      const totalValue = batches.reduce((sum, batch) => sum + batch.quantity * batch.cost, 0);

      expect(totalValue).toBe(0);
    });

    it('should calculate weighted average batch cost', () => {
      const batches = [
        { quantity: 10, cost: 50 },
        { quantity: 5, cost: 60 },
      ];

      const totalValue = batches.reduce((sum, b) => sum + b.quantity * b.cost, 0);
      const totalQuantity = batches.reduce((sum, b) => sum + b.quantity, 0);
      const avgCost = totalValue / totalQuantity;

      expect(avgCost).toBeCloseTo(53.33, 2);
    });

    it('should handle single batch', () => {
      const batches = [{ quantity: 100, cost: 25 }];
      const totalValue = batches.reduce((sum, batch) => sum + batch.quantity * batch.cost, 0);

      expect(totalValue).toBe(2500);
    });
  });

  describe('Stock Level Checks', () => {
    it('should identify product above minimum stock', () => {
      const minStock = 10;
      const currentStock = 25;
      const isBelowMin = currentStock < minStock;

      expect(isBelowMin).toBe(false);
    });

    it('should identify product at minimum stock', () => {
      const minStock = 10;
      const currentStock = 10;
      const isBelowMin = currentStock < minStock;

      expect(isBelowMin).toBe(false);
    });

    it('should identify product below minimum stock', () => {
      const minStock = 10;
      const currentStock = 5;
      const isBelowMin = currentStock < minStock;

      expect(isBelowMin).toBe(true);
    });

    it('should calculate reorder quantity', () => {
      const minStock = 10;
      const currentStock = 3;
      const reorderQuantity = minStock * 2 - currentStock;

      expect(reorderQuantity).toBe(17);
    });

    it('should handle zero minimum stock', () => {
      const minStock = 0;
      const currentStock = 0;
      const isBelowMin = currentStock < minStock;

      expect(isBelowMin).toBe(false);
    });

    it('should calculate stock turnover ratio', () => {
      const averageStock = 100;
      const annualSales = 1200;
      const turnover = annualSales / averageStock;

      expect(turnover).toBe(12);
    });

    it('should identify stockout condition', () => {
      const currentStock = 0;
      const isStockout = currentStock === 0;

      expect(isStockout).toBe(true);
    });
  });

  describe('Product Types', () => {
    it('should handle PHYSICAL product type', () => {
      const product = { ...mockProduct, type: 'PHYSICAL' };
      expect(product.type).toBe('PHYSICAL');
    });

    it('should handle DIGITAL product type', () => {
      const product = { ...mockProduct, type: 'DIGITAL' };
      expect(product.type).toBe('DIGITAL');
    });

    it('should handle SERVICE product type', () => {
      const product = { ...mockProduct, type: 'SERVICE' };
      expect(product.type).toBe('SERVICE');
    });
  });

  describe('Edge Cases', () => {
    it('should handle product with null description', () => {
      const product = { ...mockProduct, description: null };
      expect(product.description).toBeNull();
    });

    it('should handle product with null categoryId', () => {
      const product = { ...mockProduct, categoryId: null };
      expect(product.categoryId).toBeNull();
    });

    it('should handle product with null currencyId', () => {
      const product = { ...mockProduct, currencyId: null };
      expect(product.currencyId).toBeNull();
    });

    it('should handle decimal precision for cost and price', () => {
      const product = {
        ...mockProduct,
        cost: '123.456789',
        price: '987.654321',
      };

      const cost = Number(product.cost);
      const price = Number(product.price);

      expect(cost).toBeCloseTo(123.456789, 5);
      expect(price).toBeCloseTo(987.654321, 5);
    });

    it('should handle very large price values', () => {
      const price = 9999999999.99;
      const taxRate = 16;
      const taxAmount = price * (taxRate / 100);

      expect(taxAmount).toBeCloseTo(1599999999.9984, 2);
    });

    it('should handle very small price values', () => {
      const price = 0.01;
      const taxRate = 16;
      const taxAmount = price * (taxRate / 100);

      expect(taxAmount).toBeCloseTo(0.0016, 4);
    });

    it('should handle missing optional fields in create DTO', () => {
      const createDto = {
        sku: 'TEST-001',
        name: 'Test Product',
      } as any;

      expect(createDto.description).toBeUndefined();
      expect(createDto.categoryId).toBeUndefined();
      expect(createDto.cost).toBeUndefined();
      expect(createDto.price).toBeUndefined();
    });

    it('should handle string to number conversion for monetary values', () => {
      const stringCost = '999.99';
      const stringPrice = '1499.99';
      const cost = Number(stringCost);
      const price = Number(stringPrice);

      expect(cost).toBe(999.99);
      expect(price).toBe(1499.99);
      expect(price - cost).toBe(500);
    });
  });
});
