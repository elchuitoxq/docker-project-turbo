import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database';
import {
  creditNotes,
  creditNoteItems,
  creditNoteUsages,
  invoices,
  payments,
  uuidv7,
} from '../../schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import {
  CreateCreditNoteDto,
  UpdateCreditNoteDto,
  ApplyCreditNoteDto,
  CreditNoteResponseDto,
  CreditNoteListResponseDto,
  CreditNoteItemResponseDto,
  CreditNoteUsageResponseDto,
  CreditNoteStatus,
  PostCreditNoteResponseDto,
  VoidCreditNoteResponseDto,
  ApplyCreditNoteResponseDto,
} from './dto/credit-notes.dto';

@Injectable()
export class CreditNotesService {
  async findAll(partnerId?: string, status?: string): Promise<CreditNoteListResponseDto[]> {
    const conditions = [];

    if (partnerId) {
      conditions.push(eq(creditNotes.partnerId, partnerId));
    }

    if (status) {
      conditions.push(eq(creditNotes.status, status as CreditNoteStatus));
    }

    const query =
      conditions.length > 0
        ? db
            .select()
            .from(creditNotes)
            .where(and(...conditions))
            .orderBy(desc(creditNotes.createdAt))
        : db.select().from(creditNotes).orderBy(desc(creditNotes.createdAt));

    const allCreditNotes = await query;

    const result: CreditNoteListResponseDto[] = [];
    for (const cn of allCreditNotes) {
      const usages = await db
        .select()
        .from(creditNoteUsages)
        .where(eq(creditNoteUsages.creditNoteId, cn.id));

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = Number(cn.total) - totalUsed;

      result.push({
        id: cn.id,
        code: cn.code,
        partnerId: cn.partnerId,
        status: cn.status as CreditNoteStatus,
        total: Number(cn.total),
        availableAmount,
        date: cn.date,
        createdAt: cn.createdAt,
      });
    }

    return result;
  }

  async findOne(id: string): Promise<CreditNoteResponseDto> {
    const [creditNote] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1);

    if (!creditNote) {
      throw new NotFoundException(`Credit note with ID ${id} not found`);
    }

    const items = await db
      .select()
      .from(creditNoteItems)
      .where(eq(creditNoteItems.creditNoteId, id));

    const usages = await db
      .select()
      .from(creditNoteUsages)
      .where(eq(creditNoteUsages.creditNoteId, id));

    const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
    const availableAmount = Number(creditNote.total) - totalUsed;

    return {
      id: creditNote.id,
      code: creditNote.code,
      invoiceId: creditNote.invoiceId,
      partnerId: creditNote.partnerId,
      branchId: creditNote.branchId,
      warehouseId: creditNote.warehouseId,
      currencyId: creditNote.currencyId,
      exchangeRate: Number(creditNote.exchangeRate),
      status: creditNote.status as CreditNoteStatus,
      totalBase: Number(creditNote.totalBase),
      totalTax: Number(creditNote.totalTax),
      totalIgtf: Number(creditNote.totalIgtf),
      total: Number(creditNote.total),
      availableAmount,
      date: creditNote.date,
      userId: creditNote.userId,
      createdAt: creditNote.createdAt,
      updatedAt: creditNote.updatedAt,
      items: items.map(this.toItemResponseDto),
      usages: usages.map(this.toUsageResponseDto),
    };
  }

  async create(
    createCreditNoteDto: CreateCreditNoteDto,
    userId?: string
  ): Promise<CreditNoteResponseDto> {
    const code = await this.generateCode();

    let totalBase = 0;
    let totalTax = 0;
    let totalIgtf = 0;
    let total = 0;

    const itemsWithTotals = createCreditNoteDto.items.map(item => {
      const itemTotal = item.quantity * item.price;
      totalBase += itemTotal;
      total += itemTotal;
      return {
        ...item,
        total: itemTotal.toString(),
      };
    });

    total = totalBase + totalTax + totalIgtf;

    const [newCreditNote] = await db
      .insert(creditNotes)
      .values({
        code,
        invoiceId: createCreditNoteDto.invoiceId,
        partnerId: createCreditNoteDto.partnerId,
        branchId: createCreditNoteDto.branchId,
        warehouseId: createCreditNoteDto.warehouseId,
        currencyId: createCreditNoteDto.currencyId,
        exchangeRate: createCreditNoteDto.exchangeRate.toString(),
        status: 'DRAFT',
        totalBase: totalBase.toString(),
        totalTax: totalTax.toString(),
        totalIgtf: totalIgtf.toString(),
        total: total.toString(),
        date: createCreditNoteDto.date || new Date(),
        userId,
      })
      .returning();

    for (const item of itemsWithTotals) {
      await db.insert(creditNoteItems).values({
        creditNoteId: newCreditNote.id,
        productId: item.productId,
        quantity: item.quantity.toString(),
        price: item.price.toString(),
        total: item.total,
      });
    }

    return this.findOne(newCreditNote.id);
  }

  async update(
    id: string,
    updateCreditNoteDto: UpdateCreditNoteDto
  ): Promise<CreditNoteResponseDto> {
    const [existing] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Credit note with ID ${id} not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT credit notes can be updated');
    }

    const updateData: Partial<typeof creditNotes.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updateCreditNoteDto.warehouseId !== undefined) {
      updateData.warehouseId = updateCreditNoteDto.warehouseId;
    }
    if (updateCreditNoteDto.exchangeRate !== undefined) {
      updateData.exchangeRate = updateCreditNoteDto.exchangeRate.toString();
    }
    if (updateCreditNoteDto.date !== undefined) {
      updateData.date = updateCreditNoteDto.date;
    }

    await db.update(creditNotes).set(updateData).where(eq(creditNotes.id, id));

    return this.findOne(id);
  }

  async post(id: string): Promise<PostCreditNoteResponseDto> {
    const [existing] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Credit note with ID ${id} not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT credit notes can be posted');
    }

    await db
      .update(creditNotes)
      .set({
        status: 'POSTED',
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, id));

    return {
      id,
      status: 'POSTED',
      message: 'Credit note posted successfully',
    };
  }

  async void(id: string): Promise<VoidCreditNoteResponseDto> {
    const [existing] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Credit note with ID ${id} not found`);
    }

    if (existing.status === 'VOIDED') {
      throw new BadRequestException('Credit note is already voided');
    }

    if (existing.status === 'APPLIED') {
      throw new BadRequestException('Cannot void an APPLIED credit note.要先 applied credit note.');
    }

    await db
      .update(creditNotes)
      .set({
        status: 'VOIDED',
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, id));

    return {
      id,
      status: 'VOIDED',
      message: 'Credit note voided successfully',
    };
  }

  async apply(
    creditNoteId: string,
    invoiceId: string,
    applyDto: ApplyCreditNoteDto
  ): Promise<ApplyCreditNoteResponseDto> {
    const [creditNote] = await db
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, creditNoteId))
      .limit(1);

    if (!creditNote) {
      throw new NotFoundException(`Credit note with ID ${creditNoteId} not found`);
    }

    if (creditNote.status === 'DRAFT') {
      throw new BadRequestException('Cannot apply a DRAFT credit note. Post it first.');
    }

    if (creditNote.status === 'VOIDED') {
      throw new BadRequestException('Cannot apply a voided credit note');
    }

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    if (invoice.status === 'VOIDED') {
      throw new BadRequestException('Cannot apply credit note to a voided invoice');
    }

    if (creditNote.partnerId !== invoice.partnerId) {
      throw new BadRequestException('Credit note and invoice must belong to the same partner');
    }

    const usages = await db
      .select()
      .from(creditNoteUsages)
      .where(eq(creditNoteUsages.creditNoteId, creditNoteId));

    const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
    const availableAmount = Number(creditNote.total) - totalUsed;

    if (applyDto.amount > availableAmount) {
      throw new BadRequestException(
        `Amount ${applyDto.amount} exceeds available amount ${availableAmount}`
      );
    }

    const [payment] = await db
      .insert(payments)
      .values({
        code: await this.generatePaymentCode(),
        invoiceId,
        partnerId: creditNote.partnerId,
        branchId: creditNote.branchId,
        methodId: creditNote.currencyId,
        status: 'POSTED',
        type: 'CREDIT_NOTE',
        amount: applyDto.amount.toString(),
        currencyId: creditNote.currencyId,
        exchangeRate: creditNote.exchangeRate,
        date: new Date(),
      })
      .returning();

    await db.insert(creditNoteUsages).values({
      creditNoteId,
      paymentId: payment.id,
      amount: applyDto.amount.toString(),
    });

    const newTotalUsed = totalUsed + applyDto.amount;
    const newAvailableAmount = Number(creditNote.total) - newTotalUsed;

    if (newAvailableAmount <= 0) {
      await db
        .update(creditNotes)
        .set({
          status: 'APPLIED',
          updatedAt: new Date(),
        })
        .where(eq(creditNotes.id, creditNoteId));
    }

    return {
      id: creditNoteId,
      invoiceId,
      amount: applyDto.amount,
      remainingAvailableAmount: newAvailableAmount,
      message: 'Credit note applied to invoice successfully',
    };
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CN-${year}-`;

    const [latest] = await db
      .select({ code: creditNotes.code })
      .from(creditNotes)
      .where(sql`${creditNotes.code} LIKE ${prefix + '%'}`)
      .orderBy(desc(creditNotes.createdAt))
      .limit(1);

    let nextNum = 1;
    if (latest) {
      const lastNum = parseInt(latest.code.replace(prefix, ''), 10);
      nextNum = lastNum + 1;
    }

    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  }

  private async generatePaymentCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;

    const [latest] = await db
      .select({ code: payments.code })
      .from(payments)
      .where(sql`${payments.code} LIKE ${prefix + '%'}`)
      .orderBy(desc(payments.createdAt))
      .limit(1);

    let nextNum = 1;
    if (latest) {
      const lastNum = parseInt(latest.code.replace(prefix, ''), 10);
      nextNum = lastNum + 1;
    }

    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  }

  private toItemResponseDto(item: typeof creditNoteItems.$inferSelect): CreditNoteItemResponseDto {
    return {
      id: item.id,
      creditNoteId: item.creditNoteId,
      productId: item.productId,
      quantity: Number(item.quantity),
      price: Number(item.price),
      total: Number(item.total),
    };
  }

  private toUsageResponseDto(
    usage: typeof creditNoteUsages.$inferSelect
  ): CreditNoteUsageResponseDto {
    return {
      id: usage.id,
      creditNoteId: usage.creditNoteId,
      paymentId: usage.paymentId,
      amount: Number(usage.amount),
      createdAt: usage.createdAt,
    };
  }
}
