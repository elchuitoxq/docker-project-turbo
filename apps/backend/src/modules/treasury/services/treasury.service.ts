import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../../database';
import { MoneyService } from '../../../common/money/money.service';
import {
  payments,
  paymentAllocations,
  creditNotes,
  creditNoteUsages,
  taxRetentions,
  taxRetentionLines,
  documentLinks,
  invoices,
  bankAccounts,
  paymentMethods,
  partners,
} from '../../../schema';
import { eq, and, desc, gte, isNull, like, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { computeInvoiceBalance } from '../../billing/purchasing/invoice-balance';
import {
  CreatePaymentDto,
  PaymentResponseDto,
  PaymentMethodResponseDto,
  BankAccountResponseDto,
  CreatePaymentMethodDto,
  CreateBankAccountDto,
  PartnerStatementDto,
  DailyCloseDto,
  PaymentStatus,
  PaymentType,
} from '../dto/treasury.dto';

const PAYMENT_METHODS_BALANCE_AFFECTING = ['CASH_USD', 'CASH_VES', 'POS', 'ZELLE', 'TRANSFER'];

/** Datos mínimos para registrar el pago de una nómina desde otro módulo. */
export interface PayrollPaymentInput {
  payrollRunId: string;
  branchId: string;
  methodId: string;
  /** Monto a pagar en la moneda del run. */
  amount: number;
  currencyId: string;
  exchangeRate: string | number;
  bankAccountId?: string | null;
  reference?: string | null;
  date?: Date;
  userId?: string | null;
}

@Injectable()
export class TreasuryService {
  constructor(private readonly money: MoneyService) {}
  private async getNextPaymentCode(
    branchId: string,
    executor: Pick<typeof db, 'select'> = db
  ): Promise<string> {
    // `payments.code` es único a nivel global: la numeración también debe serlo.
    // MÃ¡ximo sobre todos los cÃ³digos PAY-nnnnn, no sÃ³lo sobre el Ãºltimo insertado.
    const existing = await executor
      .select({ code: payments.code })
      .from(payments)
      .where(like(payments.code, 'PAY-%'));

    let nextNumber = 1;
    for (const row of existing) {
      const match = row.code.match(/^PAY-(\d+)$/);
      if (match) {
        nextNumber = Math.max(nextNumber, parseInt(match[1], 10) + 1);
      }
    }

    return `PAY-${String(nextNumber).padStart(5, '0')}`;
  }

  async findAll(branchId: string, status?: PaymentStatus): Promise<PaymentResponseDto[]> {
    const conditions = [eq(payments.branchId, branchId)];
    if (status) conditions.push(eq(payments.status, status));

    const allPayments = await db
      .select()
      .from(payments)
      .where(and(...conditions));

    return allPayments.map(p => ({
      ...p,
      amount: parseFloat(String(p.amount)),
    }));
  }

  async findOne(id: string, branchId?: string): Promise<PaymentResponseDto> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);

    // R2: recurso de otra sucursal -> 404.
    if (!payment || (branchId && payment.branchId !== branchId)) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return {
      ...payment,
      amount: parseFloat(String(payment.amount)),
    };
  }

  /**
   * Pago de una nómina (`T-02-06`). Es el único punto que crea un `payment` con `payrollRunId`,
   * y la base tiene un índice único parcial para que un run no se pague dos veces (RN-24).
   */
  async registerPayrollPayment(input: PayrollPaymentInput): Promise<PaymentResponseDto> {
    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, input.methodId))
      .limit(1);

    if (!method) {
      throw new NotFoundException(`Payment method with ID ${input.methodId} not found`);
    }

    const affectsBalance = PAYMENT_METHODS_BALANCE_AFFECTING.includes(method.code);
    const amountBase = this.money.round(this.money.toBase(input.amount, input.exchangeRate));

    const created = await db.transaction(async tx => {
      // El código se asigna con advisory lock: `payments.code` es único global.
      await tx.execute(sql`select pg_advisory_xact_lock(42004)`);
      const code = await this.getNextPaymentCode(input.branchId, tx);

      const [payment] = await tx
        .insert(payments)
        .values({
          id: uuidv4(),
          code,
          partnerId: null,
          branchId: input.branchId,
          methodId: input.methodId,
          status: PaymentStatus.POSTED,
          type: PaymentType.EXPENSE,
          amount: String(input.amount),
          currencyId: input.currencyId,
          exchangeRate: String(input.exchangeRate),
          amountBase,
          bankAccountId: input.bankAccountId ?? null,
          payrollRunId: input.payrollRunId,
          reference: input.reference ?? null,
          metadata: { payrollRunId: input.payrollRunId },
          date: input.date ?? new Date(),
          userId: input.userId ?? null,
        })
        .returning();

      if (affectsBalance && input.bankAccountId) {
        const [account] = await tx
          .select()
          .from(bankAccounts)
          .where(eq(bankAccounts.id, input.bankAccountId))
          .limit(1);

        if (account) {
          const balance = Number(account.currentBalance ?? 0) - input.amount;
          await tx
            .update(bankAccounts)
            .set({ currentBalance: String(balance), updatedAt: new Date() })
            .where(eq(bankAccounts.id, account.id));
        }
      }

      return payment;
    });

    return { ...created, amount: Number(created.amount) };
  }

  /** Pago ya registrado para un run de nómina, si existe. Es la llave de la idempotencia. */
  async findPayrollPayment(payrollRunId: string): Promise<PaymentResponseDto | null> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.payrollRunId, payrollRunId))
      .limit(1);

    return payment ? { ...payment, amount: Number(payment.amount) } : null;
  }

  async create(
    createPaymentDto: CreatePaymentDto,
    userId: string,
    branchId?: string
  ): Promise<PaymentResponseDto> {
    const paymentBranchId = branchId ?? createPaymentDto.branchId;
    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, createPaymentDto.methodId))
      .limit(1);

    if (!method) {
      throw new NotFoundException(`Payment method with ID ${createPaymentDto.methodId} not found`);
    }

    const affectsBalance = PAYMENT_METHODS_BALANCE_AFFECTING.includes(method.code);

    // Las asignaciones se validan antes de escribir: si el importe no cuadra, el pago no debe
    // quedar registrado (regla 6 de `S-03`).
    const allocationRequests =
      createPaymentDto.allocations && createPaymentDto.allocations.length > 0
        ? createPaymentDto.allocations
        : createPaymentDto.invoiceId
          ? [{ invoiceId: createPaymentDto.invoiceId, amount: createPaymentDto.amount }]
          : [];

    const requested = allocationRequests.reduce((sum, item) => sum + item.amount, 0);

    if (Number(this.money.round(requested)) > Number(this.money.round(createPaymentDto.amount))) {
      throw new BadRequestException(
        `Las asignaciones (${requested}) superan el importe del pago (${createPaymentDto.amount})`
      );
    }

    // Regla 4 de `S-03`: el pago no puede exceder el saldo de la factura. Si se paga en otra
    // moneda, el monto equivalente depende de la tasa del día y la diferencia se registra como
    // resultado cambiario, así que la comparación exacta sólo aplica en la moneda del documento.
    for (const allocation of allocationRequests) {
      const computed = await computeInvoiceBalance(allocation.invoiceId);

      if (!computed) {
        throw new NotFoundException(`Invoice with ID ${allocation.invoiceId} not found`);
      }

      const [target] = await db
        .select({ currencyId: invoices.currencyId })
        .from(invoices)
        .where(eq(invoices.id, allocation.invoiceId))
        .limit(1);

      const sameCurrency = target?.currencyId === createPaymentDto.currencyId;

      if (
        sameCurrency &&
        Number(this.money.round(allocation.amount)) > Number(this.money.round(computed.balance))
      ) {
        throw new BadRequestException(
          `La asignación (${allocation.amount}) supera el saldo de la factura (${computed.balance})`
        );
      }
    }

    if (affectsBalance && createPaymentDto.bankAccountId) {
      const [bankAccount] = await db
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, createPaymentDto.bankAccountId))
        .limit(1);

      if (bankAccount) {
        const currentBalance = parseFloat(String(bankAccount.currentBalance));
        const newBalance =
          createPaymentDto.type === PaymentType.INCOME
            ? currentBalance + createPaymentDto.amount
            : currentBalance - createPaymentDto.amount;

        await db
          .update(bankAccounts)
          .set({ currentBalance: String(newBalance) })
          .where(eq(bankAccounts.id, bankAccount.id));
      }
    }

    // El código se asigna con advisory lock dentro de una transacción: `payments.code` es único a
    // nivel global y dos cobros concurrentes podían leer el mismo máximo (H-69).
    const newPayment = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(42004)`);
      const code = await this.getNextPaymentCode(paymentBranchId, tx);

      const [row] = await tx
        .insert(payments)
        .values({
          id: uuidv4(),
          code,
          invoiceId: createPaymentDto.invoiceId,
          partnerId: createPaymentDto.partnerId,
          branchId: paymentBranchId,
          methodId: createPaymentDto.methodId,
          status: PaymentStatus.POSTED,
          type: createPaymentDto.type || PaymentType.INCOME,
          direction:
            (createPaymentDto.type || PaymentType.INCOME) === PaymentType.EXPENSE ? 'OUT' : 'IN',
          retentionAmount: String(createPaymentDto.retentionAmount ?? 0),
          amount: String(createPaymentDto.amount),
          currencyId: createPaymentDto.currencyId,
          exchangeRate: String(createPaymentDto.exchangeRate),
          amountBase: this.money.round(
            this.money.toBase(createPaymentDto.amount, createPaymentDto.exchangeRate)
          ),
          bankAccountId: createPaymentDto.bankAccountId,
          reference: createPaymentDto.reference,
          date: createPaymentDto.date ? new Date(createPaymentDto.date) : new Date(),
          userId,
        })
        .returning();

      return row;
    });

    if (allocationRequests.length > 0) {
      for (const allocation of allocationRequests) {
        await db.insert(paymentAllocations).values({
          id: uuidv4(),
          paymentId: newPayment.id,
          invoiceId: allocation.invoiceId,
          amount: String(allocation.amount),
          amountBase: this.money.round(
            this.money.toBase(allocation.amount, createPaymentDto.exchangeRate)
          ),
        });

        await this.refreshInvoiceBalance(allocation.invoiceId);
      }
    }

    if (createPaymentDto.invoiceId) {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, createPaymentDto.invoiceId))
        .limit(1);

      if (invoice) {
        // El estado y el saldo los fija `refreshInvoiceBalance`; aquí sólo se registra la diferencia
        // de cambio (M8) para que no se pierda al pagar con otra tasa.
        const allocatedBase = await this.calculateTotalPaidBase(createPaymentDto.invoiceId);
        const invoiceRate = invoice.exchangeRate ? Number(invoice.exchangeRate) : 1;
        const invoiceBase = Number(
          this.money.round(this.money.toBase(invoice.total ?? 0, invoiceRate))
        );
        const exchangeDifference = Number(this.money.round(allocatedBase - invoiceBase));

        if (exchangeDifference !== 0) {
          await db
            .update(payments)
            .set({
              metadata: {
                ...((newPayment.metadata as Record<string, unknown> | null) ?? {}),
                exchangeDifference,
                invoiceBase,
                allocatedBase,
                invoiceRate,
              } as never,
            })
            .where(eq(payments.id, newPayment.id));
        }
      }
    }

    return {
      ...newPayment,
      amount: createPaymentDto.amount,
    };
  }

  /**
   * Recalcula la cach? `invoices.paid_amount` y el estado de la factura.
   *
   * Las compras pasan a `PENDING`/`PARTIAL`/`PAID` (el vencimiento lo decide la antigüedad, no el
   * estado); las ventas conservan `PAID` para no cambiar el comportamiento anterior.
   */
  private async refreshInvoiceBalance(invoiceId: string): Promise<void> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    if (!invoice) return;

    const computed = await computeInvoiceBalance(invoiceId);
    if (!computed) return;

    // `paid_amount` guarda sólo el efectivo aplicado (moneda del documento); el saldo exigible
    // descuenta además notas de crédito y retenciones (H-82).
    const status =
      computed.balance <= 0.01 ? 'PAID' : computed.settled > 0.01 ? 'PARTIAL' : invoice.status;

    await db
      .update(invoices)
      .set({ paidAmount: String(computed.paid), status })
      .where(eq(invoices.id, invoiceId));
  }

  /**
   * Comprobantes de retención emitidos (`T-03-04`), con su factura de origen.
   * Filtra por sucursal, proveedor, tipo y rango de fechas.
   */
  async findRetentions(filters: {
    branchId: string;
    partnerId?: string;
    type?: string;
    from?: string;
    to?: string;
  }): Promise<unknown[]> {
    const conditions = [eq(taxRetentions.branchId, filters.branchId)];

    if (filters.partnerId) conditions.push(eq(taxRetentions.partnerId, filters.partnerId));
    if (filters.type) conditions.push(eq(taxRetentions.type, filters.type));
    if (filters.from) conditions.push(gte(taxRetentions.date, new Date(filters.from)));
    if (filters.to) {
      conditions.push(
        lte(taxRetentions.date, new Date(`${filters.to.slice(0, 10)}T23:59:59.999Z`))
      );
    }

    const rows = await db
      .select()
      .from(taxRetentions)
      .where(and(...conditions))
      .orderBy(desc(taxRetentions.date));

    return rows.map(row => ({
      id: row.id,
      code: row.code,
      voucherNumber: row.voucherNumber,
      type: row.type,
      partnerId: row.partnerId,
      invoiceId: row.invoiceId,
      period: row.period,
      date: row.date,
      totalBase: Number(row.totalBase),
      totalTax: Number(row.totalTax ?? 0),
      totalRetained: Number(row.totalRetained),
    }));
  }

  /** Total asignado a la factura, expresado en moneda funcional. */
  private async calculateTotalPaidBase(invoiceId: string): Promise<number> {
    const allocations = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId));

    let total = 0;
    for (const alloc of allocations) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, alloc.paymentId))
        .limit(1);

      if (payment && payment.status === PaymentStatus.POSTED) {
        total = Number(this.money.round(total + Number(alloc.amountBase ?? 0)));
      }
    }

    return total;
  }

  private async calculateTotalPaid(invoiceId: string): Promise<number> {
    const allocations = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId));

    let total = 0;
    for (const alloc of allocations) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, alloc.paymentId))
        .limit(1);

      if (payment && payment.status === PaymentStatus.POSTED) {
        total += parseFloat(String(alloc.amount));
      }
    }

    return total;
  }

  async voidPayment(id: string, userId?: string, branchId?: string): Promise<PaymentResponseDto> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);

    if (!payment || (branchId && payment.branchId !== branchId)) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    if (payment.status === PaymentStatus.VOID) {
      throw new BadRequestException('Payment is already void');
    }

    console.log(`[Treasury] Starting voidPayment for payment ${payment.code}`);
    console.log(`[Treasury] Step 1: Validating child Credit Notes are unspent`);

    const childCreditNotes = await db
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.parentPaymentId, id));

    for (const cn of childCreditNotes) {
      const usages = await db
        .select()
        .from(creditNoteUsages)
        .where(eq(creditNoteUsages.creditNoteId, cn.id));

      if (usages.length > 0) {
        throw new BadRequestException(`Credit note ${cn.code} has been used. Revert usages first.`);
      }
    }

    console.log(`[Treasury] Step 2: Reversing bank balance`);

    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, payment.methodId))
      .limit(1);

    const affectsBalance = method && PAYMENT_METHODS_BALANCE_AFFECTING.includes(method.code);

    if (affectsBalance && payment.bankAccountId) {
      const [bankAccount] = await db
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, payment.bankAccountId))
        .limit(1);

      if (bankAccount) {
        const currentBalance = parseFloat(String(bankAccount.currentBalance));
        const newBalance =
          payment.type === PaymentType.INCOME
            ? currentBalance - parseFloat(String(payment.amount))
            : currentBalance + parseFloat(String(payment.amount));

        await db
          .update(bankAccounts)
          .set({ currentBalance: String(newBalance) })
          .where(eq(bankAccounts.id, payment.bankAccountId));
      }
    }

    console.log(`[Treasury] Step 3: Releasing credit note usages`);

    await db.delete(creditNoteUsages).where(eq(creditNoteUsages.paymentId, id));

    console.log(`[Treasury] Step 4: Deleting daughter credit notes`);

    for (const cn of childCreditNotes) {
      await db.delete(creditNoteItems).where(eq(creditNoteItems.creditNoteId, cn.id));
    }
    await db.delete(creditNotes).where(eq(creditNotes.parentPaymentId, id));

    console.log(`[Treasury] Step 5: Cleaning up retentions`);

    const retentionLinesForPayment = await db
      .select()
      .from(taxRetentionLines)
      .where(eq(taxRetentionLines.paymentId, id));

    const retentionIds = [...new Set(retentionLinesForPayment.map(l => l.retentionId))];

    if (retentionIds.length > 0) {
      await db.delete(taxRetentionLines).where(eq(taxRetentionLines.paymentId, id));

      for (const retentionId of retentionIds) {
        const otherLines = await db
          .select()
          .from(taxRetentionLines)
          .where(eq(taxRetentionLines.retentionId, retentionId));

        if (otherLines.length === 0) {
          await db.delete(taxRetentions).where(eq(taxRetentions.id, retentionId));
        }
      }
    }

    console.log(`[Treasury] Step 6: Deleting payment allocations`);

    await db.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, id));

    console.log(`[Treasury] Step 7: Cleaning document links`);

    await db
      .delete(documentLinks)
      .where(and(eq(documentLinks.sourceId, id), eq(documentLinks.sourceTable, 'payments')));

    console.log(`[Treasury] Step 8: Reopening invoices`);

    if (payment.invoiceId) {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, payment.invoiceId))
        .limit(1);

      if (invoice) {
        await db
          .update(invoices)
          .set({ status: 'POSTED' })
          .where(eq(invoices.id, payment.invoiceId));
      }
    }

    console.log(`[Treasury] Voiding payment record`);

    await db.update(payments).set({ status: PaymentStatus.VOID }).where(eq(payments.id, id));

    return this.findOne(id);
  }

  async getMethods(branchId: string): Promise<PaymentMethodResponseDto[]> {
    const conditions = [eq(paymentMethods.branchId, branchId)];
    const methods =
      conditions.length > 0
        ? await db
            .select()
            .from(paymentMethods)
            .where(and(...conditions))
        : await db.select().from(paymentMethods);
    return methods;
  }

  async createMethod(createMethodDto: CreatePaymentMethodDto): Promise<PaymentMethodResponseDto> {
    const [newMethod] = await db
      .insert(paymentMethods)
      .values({
        id: uuidv4(),
        name: createMethodDto.name,
        code: createMethodDto.code,
        isDigital: createMethodDto.isDigital || false,
        currencyId: createMethodDto.currencyId,
        branchId: createMethodDto.branchId,
      })
      .returning();

    return newMethod;
  }

  async getBankAccounts(branchId: string): Promise<BankAccountResponseDto[]> {
    const conditions = [eq(bankAccounts.branchId, branchId)];
    const accounts =
      conditions.length > 0
        ? await db
            .select()
            .from(bankAccounts)
            .where(and(...conditions))
        : await db.select().from(bankAccounts);

    return accounts.map(acc => ({
      ...acc,
      currentBalance: parseFloat(String(acc.currentBalance)),
    }));
  }

  async createBankAccount(
    createBankAccountDto: CreateBankAccountDto
  ): Promise<BankAccountResponseDto> {
    const [newAccount] = await db
      .insert(bankAccounts)
      .values({
        id: uuidv4(),
        name: createBankAccountDto.name,
        accountNumber: createBankAccountDto.accountNumber,
        type: createBankAccountDto.type,
        currencyId: createBankAccountDto.currencyId,
        branchId: createBankAccountDto.branchId,
        currentBalance: String(createBankAccountDto.currentBalance || 0),
        isActive: true,
      })
      .returning();

    return {
      ...newAccount,
      currentBalance: parseFloat(String(newAccount.currentBalance)),
    };
  }

  async getPartnerStatement(partnerId: string, branchId?: string): Promise<PartnerStatementDto> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);

    if (!partner) {
      throw new NotFoundException(`Partner with ID ${partnerId} not found`);
    }

    const paymentConditions = [
      eq(payments.partnerId, partnerId),
      eq(payments.status, PaymentStatus.POSTED),
    ];
    const invoiceConditions = [eq(invoices.partnerId, partnerId)];
    if (branchId) {
      paymentConditions.push(eq(payments.branchId, branchId));
      invoiceConditions.push(eq(invoices.branchId, branchId));
    }

    const partnerPayments = await db
      .select()
      .from(payments)
      .where(and(...paymentConditions));

    const partnerInvoices = await db
      .select()
      .from(invoices)
      .where(and(...invoiceConditions));

    let totalPaid = 0;
    for (const p of partnerPayments) {
      totalPaid += parseFloat(String(p.amount));
    }

    let totalOutstanding = 0;
    const outstandingInvoices = [];

    for (const inv of partnerInvoices) {
      if (inv.status !== 'PAID' && inv.status !== 'VOID') {
        const paid = await this.calculateTotalPaid(inv.id);
        const pending = parseFloat(String(inv.total)) - paid;
        totalOutstanding += pending;

        outstandingInvoices.push({
          id: inv.id,
          code: inv.code,
          date: inv.date,
          total: parseFloat(String(inv.total)),
          paid,
          pending,
        });
      }
    }

    return {
      partnerId,
      partnerName: partner.name,
      partnerTaxId: partner.taxId,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      creditBalance: Math.round((totalPaid - totalOutstanding) * 100) / 100,
      recentPayments: partnerPayments.slice(0, 10).map(p => ({
        ...p,
        amount: parseFloat(String(p.amount)),
      })),
      outstandingInvoices,
    };
  }

  async getDailyClose(date: string, branchId: string): Promise<DailyCloseDto> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const conditions = [eq(payments.status, PaymentStatus.POSTED)];

    if (branchId) {
      conditions.push(eq(payments.branchId, branchId));
    }

    const dayPayments = await db
      .select()
      .from(payments)
      .where(and(...conditions));

    let totalIncome = 0;
    let totalExpense = 0;

    const byMethodMap = new Map<string, { income: number; expense: number }>();
    const byCurrencyMap = new Map<string, { income: number; expense: number }>();

    for (const p of dayPayments) {
      const amount = parseFloat(String(p.amount));

      if (p.type === PaymentType.INCOME) {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }

      const [method] = await db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.id, p.methodId))
        .limit(1);

      if (method) {
        const current = byMethodMap.get(method.name) || { income: 0, expense: 0 };
        if (p.type === PaymentType.INCOME) {
          current.income += amount;
        } else {
          current.expense += amount;
        }
        byMethodMap.set(method.name, current);
      }

      const [currency] = await db
        .select()
        .from(currencies)
        .where(eq(currencies.id, p.currencyId))
        .limit(1);

      if (currency) {
        const current = byCurrencyMap.get(currency.code) || { income: 0, expense: 0 };
        if (p.type === PaymentType.INCOME) {
          current.income += amount;
        } else {
          current.expense += amount;
        }
        byCurrencyMap.set(currency.code, current);
      }
    }

    return {
      date,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netBalance: Math.round((totalIncome - totalExpense) * 100) / 100,
      byPaymentMethod: Array.from(byMethodMap.entries()).map(([methodName, data]) => ({
        methodName,
        income: Math.round(data.income * 100) / 100,
        expense: Math.round(data.expense * 100) / 100,
      })),
      byCurrency: Array.from(byCurrencyMap.entries()).map(([currencyCode, data]) => ({
        currencyCode,
        income: Math.round(data.income * 100) / 100,
        expense: Math.round(data.expense * 100) / 100,
      })),
    };
  }

  async getAvailableCreditNotes(partnerId: string): Promise<any[]> {
    const creditNotesList = await db
      .select()
      .from(creditNotes)
      .where(and(eq(creditNotes.partnerId, partnerId), eq(creditNotes.status, 'POSTED')));

    const available: any[] = [];

    for (const cn of creditNotesList) {
      const usages = await db
        .select()
        .from(creditNoteUsages)
        .where(eq(creditNoteUsages.creditNoteId, cn.id));

      let usedAmount = 0;
      for (const usage of usages) {
        usedAmount += parseFloat(String(usage.amount));
      }

      const total = parseFloat(String(cn.total));
      const availableAmount = total - usedAmount;

      if (availableAmount > 0) {
        available.push({
          id: cn.id,
          code: cn.code,
          date: cn.date,
          total,
          usedAmount,
          availableAmount,
        });
      }
    }

    return available;
  }
}

import { creditNoteItems, currencies } from '../../../schema';
