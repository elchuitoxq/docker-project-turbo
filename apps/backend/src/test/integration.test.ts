import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanDatabase, closeTestConnection } from './database';
import {
  createTestBranch,
  createTestCurrency,
  createTestPartner,
  createTestProduct,
  createTestInvoice,
  createTestInvoiceItem,
} from './factories';

beforeAll(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeTestConnection();
});

describe('Partners Integration Tests', () => {
  describe('createTestPartner', () => {
    it('should create a partner with default values', async () => {
      const partner = await createTestPartner();

      expect(partner).toBeDefined();
      expect(partner.id).toBeDefined();
      expect(partner.name).toContain('Partner');
      expect(partner.taxId).toMatch(/^J-\d+$/);
      expect(partner.type).toBe('CUSTOMER');
      expect(partner.taxpayerType).toBe('ORDINARY');
    });

    it('should create a partner with custom values', async () => {
      const partner = await createTestPartner({
        name: 'Custom Partner',
        type: 'SUPPLIER',
        taxpayerType: 'SPECIAL',
        retentionRate: '75',
      });

      expect(partner.name).toBe('Custom Partner');
      expect(partner.type).toBe('SUPPLIER');
      expect(partner.taxpayerType).toBe('SPECIAL');
      expect(partner.retentionRate).toBe('75');
    });

    it('should enforce unique taxId', async () => {
      const taxId = `J-${Math.random().toString().substring(2, 11)}`;

      await createTestPartner({ taxId });

      await expect(createTestPartner({ taxId })).rejects.toThrow();
    });
  });
});

describe('Products Integration Tests', () => {
  describe('createTestProduct', () => {
    it('should create a product with default values', async () => {
      const product = await createTestProduct();

      expect(product).toBeDefined();
      expect(product.id).toBeDefined();
      expect(product.sku).toMatch(/^SKU/);
      expect(product.name).toContain('Product');
      expect(product.price).toBe('150.00');
      expect(product.taxRate).toBe('16.00');
      expect(product.isExempt).toBe(false);
    });

    it('should create an exempt product', async () => {
      const product = await createTestProduct({
        name: 'Exempt Product',
        isExempt: true,
        taxRate: '0.00',
      });

      expect(product.isExempt).toBe(true);
      expect(product.taxRate).toBe('0.00');
    });
  });
});

describe('Invoice Integration Tests', () => {
  let branchId: string;
  let currencyId: string;
  let partnerId: string;
  let productId: string;

  beforeAll(async () => {
    const branch = await createTestBranch();
    branchId = branch.id;

    const currency = await createTestCurrency({ isBase: true });
    currencyId = currency.id;

    const partner = await createTestPartner();
    partnerId = partner.id;

    const product = await createTestProduct();
    productId = product.id;
  });

  describe('createTestInvoice', () => {
    it('should create an invoice with default values', async () => {
      const invoice = await createTestInvoice(partnerId, branchId, currencyId);

      expect(invoice).toBeDefined();
      expect(invoice.code).toMatch(/^INV-\d+-\d+$/);
      expect(invoice.partnerId).toBe(partnerId);
      expect(invoice.branchId).toBe(branchId);
      expect(invoice.currencyId).toBe(currencyId);
      expect(invoice.status).toBe('DRAFT');
      expect(invoice.fiscalStatus).toBe('PENDING');
    });

    it('should create invoice items', async () => {
      const invoice = await createTestInvoice(partnerId, branchId, currencyId);
      const item = await createTestInvoiceItem(invoice.id, productId, {
        quantity: '5.0000',
        price: '100.00',
        taxRate: '16.00',
        total: '580.00',
      });

      expect(item.invoiceId).toBe(invoice.id);
      expect(item.productId).toBe(productId);
      expect(item.quantity).toBe('5.0000');
      expect(item.total).toBe('580.00');
    });
  });
});
