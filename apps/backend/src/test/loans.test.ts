import { describe, expect, it } from 'vitest';
import { testDb } from './database';
import { createTestBranch, createTestPartner, createTestProduct } from './factories';
import { loans } from '../schema';
import { eq } from 'drizzle-orm';
import { LoansService } from '../modules/loans/loans.service';
import { CreateLoanDto, LoanStatus, PayLoanDto } from '../modules/loans/dto/loans.dto';

/** Sufijo único por llamada: evita colisiones entre archivos que corren en paralelo. */
function uniqueCode(): string {
  return `LOAN-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

describe('Prestamos de articulos', () => {
  const service = new LoansService();

  async function scenario(quantities: number[]) {
    const branch = await createTestBranch();
    const partner = await createTestPartner({ type: 'EMPLOYEE' });
    const products = await Promise.all(quantities.map(() => createTestProduct()));

    const dto = {
      code: uniqueCode(),
      partnerId: partner.id,
      notes: 'Prestamo de equipos',
      items: products.map((product, index) => ({
        productId: product.id,
        quantity: quantities[index],
      })),
    } as CreateLoanDto;

    const loan = await service.create(dto, branch.id);
    return { loan, branch, partner, products };
  }

  it('registra los items entregados al crear el prestamo', async () => {
    const { loan } = await scenario([2]);

    expect(loan.status).toBe(LoanStatus.PENDING);
    expect(loan.items).toHaveLength(1);
    expect(loan.items?.[0].kind).toBe('DELIVERED');
    expect(loan.items?.[0].quantity).toBe(2);
  });

  it('mantiene el prestamo ACTIVE mientras la devolucion sea parcial', async () => {
    const { loan, branch, products } = await scenario([3]);
    await service.approve(loan.id, branch.id);

    const partial: PayLoanDto = { items: [{ productId: products[0].id, quantity: 1 }] };
    const updated = await service.pay(loan.id, partial, branch.id);

    expect(updated.status).toBe(LoanStatus.ACTIVE);
    expect(updated.returnDate).toBeNull();
    expect(updated.items?.filter(item => item.kind === 'RETURNED')).toHaveLength(1);
  });

  it('cierra el prestamo cuando lo devuelto cubre lo entregado', async () => {
    const { loan, branch, products } = await scenario([2, 1]);
    await service.approve(loan.id, branch.id);

    await service.pay(loan.id, { items: [{ productId: products[0].id, quantity: 2 }] }, branch.id);

    // El segundo articulo sigue pendiente: no debe cerrarse.
    let current = await service.findOne(loan.id, branch.id);
    expect(current.status).toBe(LoanStatus.ACTIVE);

    current = await service.pay(
      loan.id,
      { items: [{ productId: products[1].id, quantity: 1 }] },
      branch.id
    );

    expect(current.status).toBe(LoanStatus.PAID);
    expect(current.returnDate).not.toBeNull();
  });

  it('rechaza la devolucion si el prestamo no esta ACTIVE', async () => {
    const { loan, branch, products } = await scenario([1]);

    await expect(
      service.pay(loan.id, { items: [{ productId: products[0].id, quantity: 1 }] }, branch.id)
    ).rejects.toThrow(/ACTIVE/);
  });

  it('rechaza la devolucion sin items', async () => {
    const { loan, branch } = await scenario([1]);
    await service.approve(loan.id, branch.id);

    await expect(service.pay(loan.id, { items: [] }, branch.id)).rejects.toThrow(
      /items are required/
    );
  });

  it('no expone prestamos de otra sucursal', async () => {
    const { loan, branch, products } = await scenario([1]);
    const otherBranch = await createTestBranch({ companyId: branch.companyId });

    await expect(service.findOne(loan.id, otherBranch.id)).rejects.toThrow(/not found/);
    await expect(
      service.pay(loan.id, { items: [{ productId: products[0].id, quantity: 1 }] }, otherBranch.id)
    ).rejects.toThrow(/not found/);
  });

  it('guarda el estado PAID en la base y no solo en la respuesta', async () => {
    const { loan, branch, products } = await scenario([1]);
    await service.approve(loan.id, branch.id);
    await service.pay(loan.id, { items: [{ productId: products[0].id, quantity: 1 }] }, branch.id);

    const [stored] = await testDb.select().from(loans).where(eq(loans.id, loan.id)).limit(1);
    expect(stored.status).toBe(LoanStatus.PAID);
    expect(stored.returnDate).not.toBeNull();
  });
});
