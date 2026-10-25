import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '../../database';
import { loans, loanItems, partners } from '../../schema';
import { eq, and, sql } from 'drizzle-orm';
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
  async findAll(filters: {
    employeeId?: string;
    status?: string;
  }): Promise<LoanResponseDto[]> {
    let query = db.select().from(loans);

    const conditions = [];

    if (filters.employeeId) {
      conditions.push(eq(loans.partnerId, filters.employeeId));
    }

    if (filters.status) {
      conditions.push(eq(loans.status, filters.status));
    }

    if (conditions.length > 0) {
      query = db.select().from(loans).where(and(...conditions)) as any;
    }

    const allLoans = await query;
    return Promise.all(allLoans.map((loan) => this.toResponseDto(loan)));
  }

  async findOne(id: string): Promise<LoanResponseDto> {
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    return this.toResponseDto(loan, true);
  }

  async create(createLoanDto: CreateLoanDto): Promise<LoanResponseDto> {
    const [existingPartner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, createLoanDto.partnerId))
      .limit(1);

    if (!existingPartner) {
      throw new NotFoundException(
        `Partner with ID ${createLoanDto.partnerId} not found`,
      );
    }

    const [newLoan] = await db
      .insert(loans)
      .values({
        code: createLoanDto.code,
        partnerId: createLoanDto.partnerId,
        status: LoanStatus.PENDING,
        dueDate: createLoanDto.dueDate
          ? new Date(createLoanDto.dueDate)
          : null,
        notes: createLoanDto.notes,
      })
      .returning();

    if (createLoanDto.items && createLoanDto.items.length > 0) {
      await db.insert(loanItems).values(
        createLoanDto.items.map((item) => ({
          loanId: newLoan.id,
          productId: item.productId,
          quantity: item.quantity.toString(),
          serialNumber: item.serialNumber,
          condition: item.condition || 'GOOD',
        })),
      );
    }

    return this.findOne(newLoan.id);
  }

  async update(id: string, updateLoanDto: UpdateLoanDto): Promise<LoanResponseDto> {
    const [existing] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);

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

  async approve(id: string): Promise<LoanResponseDto> {
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(
        `Loan must be PENDING to approve. Current status: ${loan.status}`,
      );
    }

    await db
      .update(loans)
      .set({ status: LoanStatus.ACTIVE, returnDate: null })
      .where(eq(loans.id, id));

    return this.findOne(id);
  }

  async reject(id: string): Promise<LoanResponseDto> {
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(
        `Loan must be PENDING to reject. Current status: ${loan.status}`,
      );
    }

    await db
      .update(loans)
      .set({ status: LoanStatus.REJECTED })
      .where(eq(loans.id, id));

    return this.findOne(id);
  }

  async pay(id: string, payLoanDto: PayLoanDto): Promise<LoanResponseDto> {
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id))
      .limit(1);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException(
        `Loan must be ACTIVE to record payment. Current status: ${loan.status}`,
      );
    }

    if (!payLoanDto.items || payLoanDto.items.length === 0) {
      throw new BadRequestException('Payment items are required');
    }

    await db.insert(loanItems).values(
      payLoanDto.items.map((item) => ({
        loanId: id,
        productId: item.productId,
        quantity: item.quantity.toString(),
        serialNumber: item.serialNumber,
        condition: item.condition || 'GOOD',
      })),
    );

    return this.findOne(id);
  }

  private async toResponseDto(
    loan: typeof loans.$inferSelect,
    includeItems = false,
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
      const items = await db
        .select()
        .from(loanItems)
        .where(eq(loanItems.loanId, loan.id));

      response.items = items.map((item) => this.toItemResponseDto(item));
    }

    return response;
  }

  private toItemResponseDto(
    item: typeof loanItems.$inferSelect,
  ): LoanItemResponseDto {
    return {
      id: item.id,
      loanId: item.loanId,
      productId: item.productId,
      quantity: Number(item.quantity),
      serialNumber: item.serialNumber,
      condition: item.condition,
    };
  }
}
