import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database';
import {
  creditNotes,
  creditNoteItems,
  creditNoteUsages,
  documentLinks,
  invoices,
} from '../../schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { computeInvoiceBalance } from '../billing/purchasing/invoice-balance';
import { InventoryService } from '../inventory/inventory.service';
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
  constructor(private readonly inventory: InventoryService = new InventoryService()) {}

  /** R2: valida que la nota pertenezca a la sucursal activa (404 si no). */
  private async assertBranch(id: string, branchId?: string): Promise<void> {
    if (!branchId) return;

    const [creditNote] = await db
      .select({ branchId: creditNotes.branchId })
      .from(creditNotes)
      .where(eq(creditNotes.id, id))
      .limit(1);

    if (!creditNote || creditNote.branchId !== branchId) {
      throw new NotFoundException(`Credit note with ID ${id} not found`);
    }
  }
  async findAll(
    partnerId?: string,
    status?: string,
    branchId?: string
  ): Promise<CreditNoteListResponseDto[]> {
    const conditions = [];

    if (branchId) {
      conditions.push(eq(creditNotes.branchId, branchId));
    }

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
        type: cn.type,
        invoiceId: cn.invoiceId,
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

  async findOne(id: string, branchId?: string): Promise<CreditNoteResponseDto> {
    const [creditNote] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1);

    // R2: nota de crédito de otra sucursal -> 404.
    if (!creditNote || (branchId && creditNote.branchId !== branchId)) {
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
      type: creditNote.type as 'SALE' | 'PURCHASE',
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
    userId?: string,
    branchId?: string
  ): Promise<CreditNoteResponseDto> {
    const creditNoteBranchId = branchId ?? createCreditNoteDto.branchId;

    if (!creditNoteBranchId) {
      throw new BadRequestException(
        'La sucursal activa es obligatoria para crear la nota de crédito'
      );
    }

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
        branchId: creditNoteBranchId,
        warehouseId: createCreditNoteDto.warehouseId,
        currencyId: createCreditNoteDto.currencyId,
        exchangeRate: createCreditNoteDto.exchangeRate.toString(),
        status: 'DRAFT',
        // `SALE` devuelve a un cliente; `PURCHASE` es una devolución a proveedor (T-03-07).
        type: createCreditNoteDto.type ?? 'SALE',
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
    updateCreditNoteDto: UpdateCreditNoteDto,
    branchId?: string
  ): Promise<CreditNoteResponseDto> {
    await this.assertBranch(id, branchId);
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

  /**
   * Emite la nota de crédito (`DRAFT → POSTED`).
   *
   * Si es una devolución a cliente, aquí es cuando la mercancía vuelve: se crea el movimiento de
   * `ENTRADA` en el almacén de la nota y se vincula al documento. El movimiento queda en borrador
   * para que el almacén lo apruebe, y la anulación de la nota lo revierte.
   */
  async post(id: string, branchId?: string, userId?: string): Promise<PostCreditNoteResponseDto> {
    await this.assertBranch(id, branchId);
    const [existing] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Credit note with ID ${id} not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT credit notes can be posted');
    }

    const items = await db
      .select()
      .from(creditNoteItems)
      .where(eq(creditNoteItems.creditNoteId, id));

    const isCustomerReturn = existing.type === 'SALE' && items.length > 0;

    if (isCustomerReturn && !existing.warehouseId) {
      throw new BadRequestException(
        'La devolución de cliente necesita el almacén que recibe la mercancía: indícalo en la nota antes de emitirla'
      );
    }

    await db.transaction(async tx => {
      if (isCustomerReturn) {
        const move = await this.inventory.createReturnEntry(
          {
            branchId: existing.branchId,
            warehouseId: existing.warehouseId!,
            note: `Devolución por nota de crédito ${existing.code}`,
            userId,
            lines: items.map(item => ({
              productId: item.productId,
              quantity: Number(item.quantity),
            })),
          },
          tx
        );

        await tx.insert(documentLinks).values({
          sourceId: id,
          sourceTable: 'CREDIT_NOTE',
          targetId: move.id,
          targetTable: 'INVENTORY_MOVE',
          type: 'RETURN',
          userId: userId ?? null,
        });
      }

      await tx
        .update(creditNotes)
        .set({
          status: 'POSTED',
          updatedAt: new Date(),
        })
        .where(eq(creditNotes.id, id));
    });

    return {
      id,
      status: 'POSTED',
      message: 'Credit note posted successfully',
    };
  }

  /**
   * Anula la nota de crédito.
   *
   * Se permite anular una nota ya aplicada: es la única forma de deshacer el crédito y de poder
   * anular después la factura (regla 5 de `S-03`). El saldo de la factura vuelve a subir solo,
   * porque el crédito cuenta únicamente mientras la nota está `POSTED`. La devolución de inventario
   * asociada se rechaza si sigue en borrador o se compensa si el almacén ya la aprobó.
   */
  async void(id: string, branchId?: string, userId?: string): Promise<VoidCreditNoteResponseDto> {
    await this.assertBranch(id, branchId);
    const [existing] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Credit note with ID ${id} not found`);
    }

    if (existing.status === 'VOIDED') {
      throw new BadRequestException('Credit note is already voided');
    }

    const [returnLink] = await db
      .select({ targetId: documentLinks.targetId })
      .from(documentLinks)
      .where(and(eq(documentLinks.sourceId, id), eq(documentLinks.sourceTable, 'CREDIT_NOTE')))
      .limit(1);

    await db.transaction(async tx => {
      await tx.delete(creditNoteUsages).where(eq(creditNoteUsages.creditNoteId, id));
      await tx
        .update(creditNotes)
        .set({
          status: 'VOIDED',
          updatedAt: new Date(),
        })
        .where(eq(creditNotes.id, id));
    });

    if (returnLink) {
      await this.inventory.revertReturnEntry(
        returnLink.targetId,
        userId,
        `Anulación de la nota de crédito ${existing.code}`
      );
    }

    return {
      id,
      status: 'VOIDED',
      message: 'Credit note voided successfully',
    };
  }

  /**
   * Aplica el saldo disponible de la nota contra una factura del mismo tercero.
   *
   * El uso queda registrado con la factura (`credit_note_usages.invoice_id`) y **sin pago**: una
   * nota de crédito no es un cobro, no entra a ninguna cuenta bancaria y no debe aparecer en
   * tesorería. Antes se insertaba un pago con `method_id` igual al id de la moneda, lo que chocaba
   * con la FK de `payment_methods` y rompía la aplicación con un 500.
   */
  async apply(
    creditNoteId: string,
    invoiceId: string,
    applyDto: ApplyCreditNoteDto,
    branchId?: string
  ): Promise<ApplyCreditNoteResponseDto> {
    await this.assertBranch(creditNoteId, branchId);
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

    if (invoice.status === 'VOID' || invoice.status === 'VOIDED') {
      throw new BadRequestException('Cannot apply credit note to a voided invoice');
    }

    if (creditNote.partnerId !== invoice.partnerId) {
      throw new BadRequestException('Credit note and invoice must belong to the same partner');
    }

    if (creditNote.currencyId !== invoice.currencyId) {
      throw new BadRequestException(
        'La nota de crédito y la factura deben estar en la misma moneda para imputar el saldo'
      );
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

    // Si el crédito ya lo descontó esta factura al emitirse la nota, aplicarlo no vuelve a bajar el
    // saldo: sólo se registra el consumo. Cuando la nota viene de otra factura (o no tiene factura de
    // origen), el uso sí acredita esta factura y no puede dejarla en negativo.
    const creditsThroughUsage = creditNote.invoiceId !== invoiceId;
    const balance = creditsThroughUsage ? await computeInvoiceBalance(invoiceId) : null;

    if (creditsThroughUsage && applyDto.amount > (balance?.balance ?? 0)) {
      throw new BadRequestException(
        `La aplicación (${applyDto.amount}) supera el saldo de la factura (${balance?.balance ?? 0})`
      );
    }

    await db.insert(creditNoteUsages).values({
      creditNoteId,
      invoiceId,
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
      invoiceId: usage.invoiceId,
      amount: Number(usage.amount),
      createdAt: usage.createdAt,
    };
  }
}
