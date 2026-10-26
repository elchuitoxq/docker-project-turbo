import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { db } from '../../../database';
import { banks } from '../../../schema';
import { eq } from 'drizzle-orm';
import { CreateBankDto, UpdateBankDto, BankResponseDto } from './dto/banks.dto';

@Injectable()
export class BanksService {
  async findAll(): Promise<BankResponseDto[]> {
    const allBanks = await db.select().from(banks);
    return allBanks.map(this.toResponseDto);
  }

  async findOne(id: string): Promise<BankResponseDto> {
    const [bank] = await db.select().from(banks).where(eq(banks.id, id)).limit(1);

    if (!bank) {
      throw new NotFoundException(`Bank with ID ${id} not found`);
    }

    return this.toResponseDto(bank);
  }

  async create(createBankDto: CreateBankDto): Promise<BankResponseDto> {
    const [existing] = await db
      .select()
      .from(banks)
      .where(eq(banks.code, createBankDto.code))
      .limit(1);

    if (existing) {
      throw new ConflictException('Bank with this code already exists');
    }

    const [newBank] = await db
      .insert(banks)
      .values({
        name: createBankDto.name,
        code: createBankDto.code,
        isActive: createBankDto.isActive !== false,
      })
      .returning();

    return this.toResponseDto(newBank);
  }

  async update(id: string, updateBankDto: UpdateBankDto): Promise<BankResponseDto> {
    const [existing] = await db.select().from(banks).where(eq(banks.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Bank with ID ${id} not found`);
    }

    if (updateBankDto.code && updateBankDto.code !== existing.code) {
      const [conflict] = await db
        .select()
        .from(banks)
        .where(eq(banks.code, updateBankDto.code))
        .limit(1);

      if (conflict) {
        throw new ConflictException('Bank with this code already exists');
      }
    }

    const updateData: Partial<typeof banks.$inferInsert> = {};

    if (updateBankDto.name !== undefined) updateData.name = updateBankDto.name;
    if (updateBankDto.code !== undefined) updateData.code = updateBankDto.code;
    if (updateBankDto.isActive !== undefined) updateData.isActive = updateBankDto.isActive;

    if (Object.keys(updateData).length > 0) {
      await db.update(banks).set(updateData).where(eq(banks.id, id));
    }

    return this.findOne(id);
  }

  async toggle(id: string): Promise<BankResponseDto> {
    const [existing] = await db.select().from(banks).where(eq(banks.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Bank with ID ${id} not found`);
    }

    await db.update(banks).set({ isActive: !existing.isActive }).where(eq(banks.id, id));

    return this.findOne(id);
  }

  private toResponseDto(bank: typeof banks.$inferSelect): BankResponseDto {
    return {
      id: bank.id,
      name: bank.name,
      code: bank.code,
      isActive: bank.isActive || false,
      createdAt: bank.createdAt,
    };
  }
}
