import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database';
import { loans, loanItems, partners } from '../../schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  CreateLoanDto,
  UpdateLoanDto,
  PayLoanDto,
  LoanResponseDto,
  LoanItemResponseDto,
  LoanStatus,
} from './dto/loans.dto';

@Injectable()
export class LoansService {
  async findAll(
    filters: { employeeId?: string; status?: string },
    branchId?: string
  ): Promise<LoanResponseDto[]> {
    let query = db.select().from(loans);

    const conditions = [];

    if (branchId) {
      conditions.push(eq(loans.branchId, branchId));
    }

    if (filters.employeeId) {
      conditions.push(eq(loans.partnerId, filters.employeeId));
    }

    if (filters.status) {
      conditions.push(eq(loans.status, filters.status));
    }

    if (conditions.length > 0) {
      query = db
        .select()
        .from(loans)
        .where(and(...conditions)) as any;
    }

    const allLoans = await query;

    if (allLoans.length === 0) return [];

    // El listado muestra artículos entregados/devueltos: se cargan en una sola consulta.
    const items = await db
      .select()
      .from(loanItems)
      .where(
        inArray(
          loanItems.loanId,
          allLoans.map(loan => loan.id)
        )
      );

    return Promise.all(
      allLoans.map(loan =>
        this.toResponseDto(
          loan,
          true,
          items.filter(item => item.loanId === loan.id)
        )
      )
    );
  }

  async findOne(id: string, branchId?: string): Promise<LoanResponseDto> {
    const [loan] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);

    // R2: prestamo de otra sucursal -> 404.
    if (!loan || (branchId && loan.branchId !== branchId)) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    return this.toResponseDto(loan, true);
  }

  async create(createLoanDto: CreateLoanDto, branchId?: string): Promise<LoanResponseDto> {
    const [existingPartner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, createLoanDto.partnerId))
      .limit(1);

    if (!existingPartner) {
      throw new NotFoundException(`Partner with ID ${createLoanDto.partnerId} not found`);
    }

    const [newLoan] = await db
      .insert(loans)
      .values({
        code: createLoanDto.code,
        partnerId: createLoanDto.partnerId,
        branchId: branchId ?? null,
        status: LoanStatus.PENDING,
        dueDate: createLoanDto.dueDate ? new Date(createLoanDto.dueDate) : null,
        notes: createLoanDto.notes,
      })
      .returning();

    if (createLoanDto.items && createLoanDto.items.length > 0) {
      await db.insert(loanItems).values(
        createLoanDto.items.map(item => ({
          loanId: newLoan.id,
          productId: item.productId,
          quantity: item.quantity.toString(),
          serialNumber: item.serialNumber,
          condition: item.condition || 'GOOD',
          kind: 'DELIVERED',
        }))
      );
    }

    return this.findOne(newLoan.id);
  }

  async update(
    id: string,
    updateLoanDto: UpdateLoanDto,
    branchId?: string
  ): Promise<LoanResponseDto> {
    if (branchId) await this.findOne(id, branchId);
    const [existing] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    const updateData: Partial<typeof loans.$inferInsert> = {};

    if (updateLoanDto.dueDate !== undefined) {
      updateData.dueDate = new Date(updateLoanDto.dueDate);
    }
    if (updateLoanDto.returnDate !== undefined) {
      updateData.returnDate = new Date(updateLoanDto.returnDate);
    }
    if (updateLoanDto.notes !== undefined) {
      updateData.notes = updateLoanDto.notes;
    }
    if (updateLoanDto.status !== undefined) {
      updateData.status = updateLoanDto.status;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(loans).set(updateData).where(eq(loans.id, id));
    }

    return this.findOne(id);
  }

  async approve(id: string, branchId?: string): Promise<LoanResponseDto> {
    if (branchId) await this.findOne(id, branchId);
    const [loan] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(
        `Loan must be PENDING to approve. Current status: ${loan.status}`
      );
    }

    await db
      .update(loans)
      .set({ status: LoanStatus.ACTIVE, returnDate: null })
      .where(eq(loans.id, id));

    return this.findOne(id);
  }

  async reject(id: string, branchId?: string): Promise<LoanResponseDto> {
    if (branchId) await this.findOne(id, branchId);
    const [loan] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(
        `Loan must be PENDING to reject. Current status: ${loan.status}`
      );
    }

    await db.update(loans).set({ status: LoanStatus.REJECTED }).where(eq(loans.id, id));

    return this.findOne(id);
  }

  async pay(id: string, payLoanDto: PayLoanDto, branchId?: string): Promise<LoanResponseDto> {
    if (branchId) await this.findOne(id, branchId);
    const [loan] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException(
        `Loan must be ACTIVE to record payment. Current status: ${loan.status}`
      );
    }

    if (!payLoanDto.items || payLoanDto.items.length === 0) {
      throw new BadRequestException('Payment items are required');
    }

    await db.insert(loanItems).values(
      payLoanDto.items.map(item => ({
        loanId: id,
        productId: item.productId,
        quantity: item.quantity.toString(),
        serialNumber: item.serialNumber,
        condition: item.condition || 'GOOD',
        kind: 'RETURNED',
      }))
    );

    // El préstamo se cierra cuando lo devuelto cubre lo entregado (H-99).
    const allItems = await db.select().from(loanItems).where(eq(loanItems.loanId, id));
    const delivered = new Map<string, number>();
    const returned = new Map<string, number>();

    for (const item of allItems) {
      const target = item.kind === 'RETURNED' ? returned : delivered;
      target.set(item.productId, (target.get(item.productId) ?? 0) + Number(item.quantity));
    }

    const fullyReturned = [...delivered.entries()].every(
      ([productId, quantity]) => (returned.get(productId) ?? 0) >= quantity
    );

    if (fullyReturned) {
      await db
        .update(loans)
        .set({ status: LoanStatus.PAID, returnDate: new Date() })
        .where(eq(loans.id, id));
    }

    return this.findOne(id);
  }

  private async toResponseDto(
    loan: typeof loans.$inferSelect,
    includeItems = false,
    preloadedItems?: (typeof loanItems.$inferSelect)[]
  ): Promise<LoanResponseDto> {
    const response: LoanResponseDto = {
      id: loan.id,
      code: loan.code,
      partnerId: loan.partnerId,
      status: loan.status as LoanStatus,
      startDate: loan.startDate,
      dueDate: loan.dueDate,
      returnDate: loan.returnDate,
      notes: loan.notes,
      createdAt: loan.createdAt,
    };

    if (includeItems) {
      const items =
        preloadedItems ?? (await db.select().from(loanItems).where(eq(loanItems.loanId, loan.id)));

      response.items = items.map(item => this.toItemResponseDto(item));
    }

    return response;
  }

  private toItemResponseDto(item: typeof loanItems.$inferSelect): LoanItemResponseDto {
    return {
      id: item.id,
      loanId: item.loanId,
      productId: item.productId,
      quantity: Number(item.quantity),
      serialNumber: item.serialNumber,
      condition: item.condition,
      kind: item.kind as 'DELIVERED' | 'RETURNED',
    };
  }
}
