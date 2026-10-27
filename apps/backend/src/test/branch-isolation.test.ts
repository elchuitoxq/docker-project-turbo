import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  createTestBranch,
  createTestCurrency,
  createTestPartner,
  createTestInvoice,
} from './factories';
import { testDb } from './database';
import { inventoryMoves } from '../schema';
import { BillingService } from '../modules/billing/services/billing.service';
import { InventoryService } from '../modules/inventory/inventory.service';

/**
 * Evidencia de `S-00`: los servicios no devuelven ni modifican datos de otra sucursal.
 * Usa datos propios por caso para no interferir con el resto de la suite.
 */
describe('Aislamiento por sucursal', () => {
  const billing = new BillingService();
  const inventory = new InventoryService();

  async function seedInvoicesByBranch() {
    const branchA = await createTestBranch();
    const branchB = await createTestBranch();
    const partner = await createTestPartner();
    const currency = await createTestCurrency();

    const invoiceA = await createTestInvoice(partner.id, branchA.id, currency.id);
    const invoiceB = await createTestInvoice(partner.id, branchB.id, currency.id);

    return { branchA, branchB, partner, currency, invoiceA, invoiceB };
  }

  it('lista solo las facturas de la sucursal activa', async () => {
    const { branchA, branchB, invoiceA, invoiceB } = await seedInvoicesByBranch();

    const fromA = await billing.findAll(branchA.id);
    expect(fromA.map(invoice => invoice.id)).toEqual([invoiceA.id]);

    const fromB = await billing.findAll(branchB.id);
    expect(fromB.map(invoice => invoice.id)).toEqual([invoiceB.id]);
  });

  it('responde 404 al pedir una factura de otra sucursal', async () => {
    const { branchA, branchB, invoiceB } = await seedInvoicesByBranch();

    await expect(billing.findOne(invoiceB.id, branchA.id)).rejects.toThrow(NotFoundException);
    await expect(billing.findOne(invoiceB.id, branchB.id)).resolves.toBeDefined();
  });

  it('no permite publicar ni anular una factura de otra sucursal', async () => {
    const { branchA, branchB, invoiceB } = await seedInvoicesByBranch();

    await expect(billing.post(invoiceB.id, branchA.id)).rejects.toThrow(NotFoundException);
    await expect(billing.void(invoiceB.id, branchA.id)).rejects.toThrow(NotFoundException);

    const posted = await billing.post(invoiceB.id, branchB.id);
    expect(posted.id).toBe(invoiceB.id);
  });

  it('lista solo los movimientos de inventario de la sucursal activa', async () => {
    const branchA = await createTestBranch();
    const branchB = await createTestBranch();

    const [moveA] = await testDb
      .insert(inventoryMoves)
      .values({ code: `MOV-A-${Date.now()}`, type: 'ENTRADA', branchId: branchA.id })
      .returning();
    const [moveB] = await testDb
      .insert(inventoryMoves)
      .values({ code: `MOV-B-${Date.now()}`, type: 'ENTRADA', branchId: branchB.id })
      .returning();

    const movesOfA = await inventory.findAllMoves(undefined, undefined, branchA.id);
    expect(movesOfA.map(move => move.id)).toEqual([moveA.id]);

    await expect(inventory.findOneMove(moveB.id, branchA.id)).rejects.toThrow(NotFoundException);
  });
});
