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
import { eq, and, desc, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
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

@Injectable()
export class TreasuryService {
  constructor(private readonly money: MoneyService) {}
  private async getNextPaymentCode(branchId: string): Promise<string> {
    const lastPayment = await db
      .select({ code: payments.code })
      .from(payments)
      .where(eq(payments.branchId, branchId))
      .orderBy(desc(payments.createdAt))
      .limit(1);

    let nextNumber = 1;
    if (lastPayment.length > 0) {
      const lastCode = lastPayment[0].code;
      const match = lastCode.match(/PAY-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
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

    const [newPayment] = await db
      .insert(payments)
      .values({
        id: uuidv4(),
        code: await this.getNextPaymentCode(paymentBranchId),
        invoiceId: createPaymentDto.invoiceId,
        partnerId: createPaymentDto.partnerId,
        branchId: paymentBranchId,
        methodId: createPaymentDto.methodId,
        status: PaymentStatus.POSTED,
        type: createPaymentDto.type || PaymentType.INCOME,
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

    if (createPaymentDto.invoiceId) {
      await db.insert(paymentAllocations).values({
        id: uuidv4(),
        paymentId: newPayment.id,
        invoiceId: createPaymentDto.invoiceId,
        amount: String(createPaymentDto.amount),
      });

      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, createPaymentDto.invoiceId))
        .limit(1);

      if (invoice) {
        const totalPaid = await this.calculateTotalPaid(createPaymentDto.invoiceId);
        const invoiceTotal = parseFloat(String(invoice.total));

        if (totalPaid >= invoiceTotal) {
          await db
            .update(invoices)
            .set({ status: 'PAID' })
            .where(eq(invoices.id, createPaymentDto.invoiceId));
        }
      }
    }

    return {
      ...newPayment,
      amount: createPaymentDto.amount,
    };
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
