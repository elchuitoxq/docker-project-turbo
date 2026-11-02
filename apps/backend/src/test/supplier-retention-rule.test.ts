import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestCurrency,
  createTestInvoice,
  createTestPartner,
  createTestUser,
} from './factories';
import {
  supplierRetentionSettings,
  taxConcepts,
  taxRetentionLines,
  taxRetentions,
  taxUnits,
} from '../schema';
import { SupplierRetentionService } from '../modules/billing/purchasing/supplier-retention.service';

/**
 * Regla de retención de ISLR (`S-21`).
 *
 * Antes el porcentaje salía siempre de los parámetros de la empresa y el concepto del proveedor era
 * decorativo. La precedencia certificada es: **concepto habilitado → tasa propia del partner →
 * parámetros de la empresa**, y el comprobante guarda el porcentaje y la regla aplicada.
 */

const retentions = new SupplierRetentionService();

function tag(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

async function companySettings(companyId: string, islrRate: number): Promise<void> {
  await testDb
    .insert(supplierRetentionSettings)
    .values({
      companyId,
      ivaRetentionRate: '75.00',
      ivaRetentionRateSpecial: '100.00',
      islrRate: islrRate.toFixed(2),
      islrSustraendo: '0.00',
      islrThreshold: '0.00',
    })
    .onConflictDoUpdate({
      target: supplierRetentionSettings.companyId,
      set: { islrRate: islrRate.toFixed(2) },
    });
}

async function concept(code: string, percentage: string, isEnabled = true): Promise<string> {
  const [row] = await testDb
    .insert(taxConcepts)
    .values({
      code: `${code}-${tag()}`,
      name: `Concepto ${code}`,
      retentionPercentage: percentage,
      baseMin: '0',
      sustraendo: '0',
      isEnabled,
    })
    .returning({ id: taxConcepts.id });

  return row.id;
}

/** Compra posteada por 1.000 + 160 de IVA con el proveedor ya configurado. */
async function purchaseWith(partnerConfig: {
  islrConceptId?: string | null;
  retentionRate?: string;
}) {
  const branch = await createTestBranch();
  const currency = await createTestCurrency({ name: `Compras ${tag()}` });
  const user = await createTestUser();
  const partner = await createTestPartner({
    type: 'SUPPLIER',
    taxpayerType: 'ORDINARY',
    retentionRate: partnerConfig.retentionRate ?? '0',
    islrConceptId: partnerConfig.islrConceptId ?? null,
  });

  await companySettings(branch.companyId!, 2);

  const invoice = await createTestInvoice(partner.id, branch.id, currency.id, {
    type: 'PURCHASE',
    status: 'POSTED',
    exchangeRate: '1.0000000',
    totalBase: '1000.00',
    totalTax: '160.00',
    total: '1160.00',
    invoiceNumber: `SUP-${tag()}`,
    userId: user.id,
  });

  return { branch, invoice, partner };
}

async function storedRetention(invoiceId: string, type: 'ISLR' | 'IVA') {
  const [row] = await testDb
    .select()
    .from(taxRetentions)
    .where(eq(taxRetentions.invoiceId, invoiceId))
    .then(rows => rows.filter(retention => retention.type === type));

  if (!row) return null;

  const [line] = await testDb
    .select()
    .from(taxRetentionLines)
    .where(eq(taxRetentionLines.retentionId, row.id));

  return { retention: row, line };
}

describe('Retención de ISLR por concepto (S-21)', () => {
  it('el concepto del proveedor manda sobre los parámetros de la empresa', async () => {
    const conceptId = await concept('ISLR-HON-T', '5.00');
    const { invoice } = await purchaseWith({ islrConceptId: conceptId });

    const result = await retentions.retainInvoice(invoice.id);

    // Empresa: 2 %. Concepto: 5 %. Gana el concepto.
    expect(result.islrRetained).toBeCloseTo(50, 2);
    expect(result.islrRate).toBe(5);
    expect(result.islrRuleSource).toBe('CONCEPT');
    expect(result.islrConceptId).toBe(conceptId);

    const stored = await storedRetention(invoice.id, 'ISLR');
    expect(Number(stored?.retention.appliedRate)).toBe(5);
    expect(stored?.retention.ruleSource).toBe('CONCEPT');
    expect(stored?.line.conceptId).toBe(conceptId);
  });

  it('sin concepto usa la tasa propia del proveedor', async () => {
    const { invoice } = await purchaseWith({ retentionRate: '4.00' });

    const result = await retentions.retainInvoice(invoice.id);

    expect(result.islrRetained).toBeCloseTo(40, 2);
    expect(result.islrRuleSource).toBe('PARTNER');

    const stored = await storedRetention(invoice.id, 'ISLR');
    expect(stored?.retention.ruleSource).toBe('PARTNER');
    expect(stored?.line.conceptId).toBeNull();
  });

  it('sin concepto ni tasa propia aplica los parámetros de la empresa', async () => {
    const { invoice } = await purchaseWith({});

    const result = await retentions.retainInvoice(invoice.id);

    expect(result.islrRetained).toBeCloseTo(20, 2);
    expect(result.islrRuleSource).toBe('SETTINGS');
  });

  it('un concepto deshabilitado no retiene y cae a los parámetros de la empresa', async () => {
    const conceptId = await concept('ISLR-OFF-T', '9.00', false);
    const { invoice } = await purchaseWith({ islrConceptId: conceptId });

    const result = await retentions.retainInvoice(invoice.id);

    expect(result.islrRate).toBe(2);
    expect(result.islrRuleSource).toBe('SETTINGS');
  });

  it('el comprobante de IVA guarda su porcentaje y la regla de empresa', async () => {
    const { invoice } = await purchaseWith({});

    await retentions.retainInvoice(invoice.id);

    const stored = await storedRetention(invoice.id, 'IVA');
    expect(Number(stored?.retention.appliedRate)).toBe(75);
    expect(stored?.retention.ruleSource).toBe('SETTINGS');
    expect(Number(stored?.retention.totalRetained)).toBeCloseTo(120, 2);
  });

  it('sin retención de ISLR no inventa concept ni tasa', async () => {
    const conceptId = await concept('ISLR-CERO-T', '0.00');
    const { invoice } = await purchaseWith({ islrConceptId: conceptId });

    const result = await retentions.retainInvoice(invoice.id);

    expect(result.islrRetained).toBe(0);
    expect(result.islrRate).toBeNull();
    expect(result.islrRuleSource).toBeNull();
    expect(await storedRetention(invoice.id, 'ISLR')).toBeNull();
  });
});

describe('Sustraendo en unidades tributarias (S-22)', () => {
  /** UT de prueba: 1.000 Bs desde 2025-01-01 para que la conversión sea evidente. */
  async function unitValue(): Promise<void> {
    // Se limpia la tabla: la base de pruebas persiste entre corridas y una UT posterior enmascararía
    // el valor que esta prueba quiere fijar.
    await testDb.delete(taxUnits);
    await testDb.insert(taxUnits).values({
      value: '1000.00',
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      source: 'UT de prueba',
    });
  }

  async function conceptInUt(percentage: string, sustraendoUt: string): Promise<string> {
    const [row] = await testDb
      .insert(taxConcepts)
      .values({
        code: `ISLR-UT-${tag()}`,
        name: 'Concepto con sustraendo en UT',
        retentionPercentage: percentage,
        baseMin: '0',
        sustraendo: sustraendoUt,
        sustraendoUnit: 'UT',
        isEnabled: true,
      })
      .returning({ id: taxConcepts.id });

    return row.id;
  }

  it('convierte el sustraendo con la UT vigente', async () => {
    await unitValue();
    const conceptId = await conceptInUt('10.00', '0.01');
    const { invoice } = await purchaseWith({ islrConceptId: conceptId });

    const result = await retentions.retainInvoice(invoice.id);

    // 1.000 × 10 % = 100; sustraendo 0,01 UT × 1.000 Bs = 10 → 90.
    expect(result.islrRetained).toBeCloseTo(90, 2);
    expect(result.islrRate).toBe(10);
    expect(result.islrRuleSource).toBe('CONCEPT');
  });

  it('no retiene si el sustraendo en UT supera el porcentaje', async () => {
    await unitValue();
    const conceptId = await conceptInUt('10.00', '0.25');
    const { invoice } = await purchaseWith({ islrConceptId: conceptId });

    const result = await retentions.retainInvoice(invoice.id);

    // 100 − 250 < 0: se retiene cero y no se emite comprobante de ISLR.
    expect(result.islrRetained).toBe(0);
    expect(result.islrRate).toBeNull();
    expect(await storedRetention(invoice.id, 'ISLR')).toBeNull();
  });

  it('aplica el sustraendo convertido dejando el neto correcto', async () => {
    await unitValue();
    const conceptId = await conceptInUt('30.00', '0.05');
    const { invoice } = await purchaseWith({ islrConceptId: conceptId });

    const result = await retentions.retainInvoice(invoice.id);

    // 1.000 × 30 % = 300; sustraendo 0,05 UT × 1.000 = 50 → 250.
    expect(result.islrRetained).toBeCloseTo(250, 2);
  });

  it('sin unidad tributaria cargada no aplica sustraendo en UT', async () => {
    await testDb.delete(taxUnits);
    const conceptId = await conceptInUt('10.00', '5.00');
    const { invoice } = await purchaseWith({ islrConceptId: conceptId });

    const result = await retentions.retainInvoice(invoice.id);

    // Sin UT no se inventa un valor: se retiene el porcentaje completo.
    expect(result.islrRetained).toBeCloseTo(100, 2);
  });

  it('resolveUnitValue devuelve la UT vigente a la fecha', async () => {
    await unitValue();
    await testDb.insert(taxUnits).values({
      value: '2000.00',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      source: 'UT de prueba 2026',
    });

    expect(await retentions.resolveUnitValue(new Date('2025-06-01T00:00:00.000Z'))).toBe(1000);
    expect(await retentions.resolveUnitValue(new Date('2026-03-01T00:00:00.000Z'))).toBe(2000);

    // Se deja la tabla limpia para que otra corrida arranque igual.
    await testDb.delete(taxUnits);
  });
});
