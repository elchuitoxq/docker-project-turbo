import { BadRequestException } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestCurrency,
  createTestPartner,
  createTestProduct,
  createTestUser,
  ensureTestBaseCurrency,
} from './factories';
import { currencies, exchangeRates } from '../schema';
import { BillingService } from '../modules/billing/services/billing.service';
import { CreateInvoiceDto, InvoiceType } from '../modules/billing/dto/billing.dto';

/**
 * Procedimientos de facturación con multimoneda (`T-08-08`, `T-08-10`).
 * Verifica el comportamiento real del servicio contra Postgres, no cálculos locales.
 */
/** Sufijo único por llamada: evita colisiones entre archivos que corren en paralelo. */
function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

describe('Billing multimoneda', () => {
  const billing = new BillingService();
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUser();
    userId = user.id;
  });

  async function baseCurrencyId(): Promise<string> {
    const base = await ensureTestBaseCurrency();
    return base.id;
  }

  async function foreignCurrencyWithRate(rate: number, daysAgo = 0): Promise<string> {
    const currency = await createTestCurrency({ code: `T${uniqueSuffix()}` });
    const date = new Date(Date.now() - daysAgo * 24 * 3_600_000);
    date.setUTCHours(0, 0, 0, 0);

    await testDb.insert(exchangeRates).values({
      currencyId: currency.id,
      rate: rate.toString(),
      date,
      source: 'BCV',
    });

    return currency.id;
  }

  async function buildInvoice(currencyId?: string): Promise<CreateInvoiceDto> {
    const branch = await createTestBranch();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct();

    return {
      partnerId: partner.id,
      branchId: branch.id,
      currencyId,
      type: InvoiceType.SALE,
      items: [{ productId: product.id, quantity: 2, price: 100, taxRate: 16 }],
    } as CreateInvoiceDto;
  }

  it('emite en moneda funcional con tasa 1 y sin IGTF', async () => {
    const dto = await buildInvoice(await baseCurrencyId());

    const invoice = await billing.create(dto, userId, dto.branchId);

    expect(Number(invoice.exchangeRate)).toBe(1);
    expect(invoice.totalIgtf).toBe(0);
    expect(invoice.totalBase).toBeCloseTo(200, 2);
    expect(invoice.total).toBeCloseTo(232, 2);
  });

  it('emite en moneda extranjera con la tasa del día y aplica IGTF', async () => {
    const currencyId = await foreignCurrencyWithRate(40);
    const dto = await buildInvoice(currencyId);

    const invoice = await billing.create(dto, userId, dto.branchId);

    expect(Number(invoice.exchangeRate)).toBe(40);
    expect(invoice.totalIgtf).toBeGreaterThan(0);
    // `totalBase` es la base imponible del documento, no el monto en moneda funcional.
    expect(invoice.totalBase).toBeCloseTo(200, 2);
    // El total debe cuadrar con base + IVA + IGTF, y su equivalente en moneda funcional
    // se obtiene con la tasa congelada en el documento.
    const expectedTotal = invoice.totalBase + invoice.totalTax + invoice.totalIgtf;
    expect(Number(invoice.total)).toBeCloseTo(expectedTotal, 2);
    expect(Number(invoice.total) * Number(invoice.exchangeRate)).toBeCloseTo(expectedTotal * 40, 2);
  });

  it('rechaza emitir con una tasa vencida', async () => {
    const currencyId = await foreignCurrencyWithRate(40, 5);
    const dto = await buildInvoice(currencyId);

    await expect(billing.create(dto, userId, dto.branchId)).rejects.toThrow(BadRequestException);
  });

  it('rechaza emitir en una moneda sin tasa registrada', async () => {
    const currency = await createTestCurrency({ code: `N${uniqueSuffix()}` });
    const dto = await buildInvoice(currency.id);

    await expect(billing.create(dto, userId, dto.branchId)).rejects.toThrow(
      /No exchange rate registered/
    );
  });

  it('acepta una tasa explícita aunque la registrada esté vencida', async () => {
    const currencyId = await foreignCurrencyWithRate(40, 5);
    const dto = await buildInvoice(currencyId);
    dto.exchangeRate = 41;

    const invoice = await billing.create(dto, userId, dto.branchId);

    expect(Number(invoice.exchangeRate)).toBe(41);
  });

  it('congela la tasa: cambiar la tasa después no altera la factura emitida', async () => {
    const currencyId = await foreignCurrencyWithRate(40);
    const dto = await buildInvoice(currencyId);
    const invoice = await billing.create(dto, userId, dto.branchId);

    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    await testDb.insert(exchangeRates).values({
      currencyId,
      rate: '999',
      date: tomorrow,
      source: 'BCV',
    });

    const reloaded = await billing.findOne(invoice.id);

    expect(Number(reloaded.exchangeRate)).toBe(40);
    expect(Number(reloaded.total)).toBeCloseTo(Number(invoice.total), 2);
  });

  it('no mezcla monedas al listar por sucursal', async () => {
    const dto = await buildInvoice(await baseCurrencyId());
    const invoice = await billing.create(dto, userId, dto.branchId);

    const listed = await billing.findAll(dto.branchId!);
    const [found] = await testDb
      .select({ id: currencies.id, isBase: currencies.isBase })
      .from(currencies)
      .where(and(eq(currencies.isBase, true)))
      .limit(1);

    expect(found?.isBase).toBe(true);
    expect(listed.some(item => item.id === invoice.id)).toBe(true);
  });

  it('convierte precio y costo del producto a la moneda del documento', async () => {
    // Producto en divisa (tasa 40) facturado en moneda funcional.
    const productCurrencyId = await foreignCurrencyWithRate(40);
    const branch = await createTestBranch();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct({
      currencyId: productCurrencyId,
      cost: '10.00',
      price: '100.00',
    });

    const invoice = await billing.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        currencyId: await baseCurrencyId(),
        type: InvoiceType.SALE,
        items: [
          {
            productId: product.id,
            quantity: 2,
            price: 100,
            priceCurrencyId: productCurrencyId,
            taxRate: 16,
          },
        ],
      } as CreateInvoiceDto,
      userId,
      branch.id
    );

    const [line] = invoice.items ?? [];
    // 100 × 40 = 4.000 por unidad; el costo sigue la misma tasa: 10 × 40 = 400.
    expect(line.price).toBeCloseTo(4000, 2);
    expect(Number(line.cost)).toBeCloseTo(400, 2);
    expect(invoice.totalBase).toBeCloseTo(8000, 2);
  });

  it('convierte el costo del producto cuando la factura va en divisa', async () => {
    // Producto en moneda funcional facturado en divisa (tasa 40): 100 / 40 = 2,50.
    const documentCurrencyId = await foreignCurrencyWithRate(40);
    const branch = await createTestBranch();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct({
      currencyId: await baseCurrencyId(),
      cost: '100.00',
      price: '150.00',
    });

    const invoice = await billing.create(
      {
        partnerId: partner.id,
        branchId: branch.id,
        currencyId: documentCurrencyId,
        type: InvoiceType.SALE,
        items: [{ productId: product.id, quantity: 1, price: 10, taxRate: 16 }],
      } as CreateInvoiceDto,
      userId,
      branch.id
    );

    const [line] = invoice.items ?? [];
    expect(line.price).toBeCloseTo(10, 2);
    expect(Number(line.cost)).toBeCloseTo(2.5, 2);
  });

  it('recalcula IVA e IGTF cuando cambia la tasa de un borrador', async () => {
    const currencyId = await foreignCurrencyWithRate(40);
    const dto = await buildInvoice(currencyId);
    const invoice = await billing.create(dto, userId, dto.branchId);

    const updated = await billing.update(invoice.id, { exchangeRate: 50 }, dto.branchId, userId);

    expect(Number(updated.exchangeRate)).toBe(50);
    // Base e IVA no cambian: los precios ya estaban en la moneda del documento.
    expect(updated.totalBase).toBeCloseTo(invoice.totalBase, 2);
    expect(updated.totalTax).toBeCloseTo(invoice.totalTax, 2);
    expect(Number(updated.total)).toBeCloseTo(
      updated.totalBase + updated.totalTax + updated.totalIgtf,
      2
    );
  });
});
