import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { db } from '../../../database';
import { taxConcepts } from '../../../schema';
import { eq } from 'drizzle-orm';
import {
  CreateTaxConceptDto,
  UpdateTaxConceptDto,
  TaxConceptResponseDto,
} from './dto/tax-concepts.dto';

@Injectable()
export class TaxConceptsService {
  async findAll(): Promise<TaxConceptResponseDto[]> {
    const allConcepts = await db.select().from(taxConcepts);
    return allConcepts.map(this.toResponseDto);
  }

  async findOne(id: string): Promise<TaxConceptResponseDto> {
    const [concept] = await db.select().from(taxConcepts).where(eq(taxConcepts.id, id)).limit(1);

    if (!concept) {
      throw new NotFoundException(`Tax Concept with ID ${id} not found`);
    }

    return this.toResponseDto(concept);
  }

  async create(createTaxConceptDto: CreateTaxConceptDto): Promise<TaxConceptResponseDto> {
    const [existing] = await db
      .select()
      .from(taxConcepts)
      .where(eq(taxConcepts.code, createTaxConceptDto.code))
      .limit(1);

    if (existing) {
      throw new ConflictException('Tax Concept with this code already exists');
    }

    const [newConcept] = await db
      .insert(taxConcepts)
      .values({
        code: createTaxConceptDto.code,
        name: createTaxConceptDto.name,
        retentionPercentage: createTaxConceptDto.retentionPercentage.toString(),
        baseMin: createTaxConceptDto.baseMin?.toString() || '0',
        sustraendo: createTaxConceptDto.sustraendo?.toString() || '0',
        isEnabled: createTaxConceptDto.isEnabled !== false,
      })
      .returning();

    return this.toResponseDto(newConcept);
  }

  async update(
    id: string,
    updateTaxConceptDto: UpdateTaxConceptDto
  ): Promise<TaxConceptResponseDto> {
    const [existing] = await db.select().from(taxConcepts).where(eq(taxConcepts.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Tax Concept with ID ${id} not found`);
    }

    if (updateTaxConceptDto.code && updateTaxConceptDto.code !== existing.code) {
      const [conflict] = await db
        .select()
        .from(taxConcepts)
        .where(eq(taxConcepts.code, updateTaxConceptDto.code))
        .limit(1);

      if (conflict) {
        throw new ConflictException('Tax Concept with this code already exists');
      }
    }

    const updateData: Partial<typeof taxConcepts.$inferInsert> = {};

    if (updateTaxConceptDto.code !== undefined) updateData.code = updateTaxConceptDto.code;
    if (updateTaxConceptDto.name !== undefined) updateData.name = updateTaxConceptDto.name;
    if (updateTaxConceptDto.retentionPercentage !== undefined) {
      updateData.retentionPercentage = updateTaxConceptDto.retentionPercentage.toString();
    }
    if (updateTaxConceptDto.baseMin !== undefined) {
      updateData.baseMin = updateTaxConceptDto.baseMin.toString();
    }
    if (updateTaxConceptDto.sustraendo !== undefined) {
      updateData.sustraendo = updateTaxConceptDto.sustraendo.toString();
    }
    if (updateTaxConceptDto.isEnabled !== undefined) {
      updateData.isEnabled = updateTaxConceptDto.isEnabled;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(taxConcepts).set(updateData).where(eq(taxConcepts.id, id));
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const [concept] = await db.select().from(taxConcepts).where(eq(taxConcepts.id, id)).limit(1);

    if (!concept) {
      throw new NotFoundException(`Tax Concept with ID ${id} not found`);
    }

    await db.delete(taxConcepts).where(eq(taxConcepts.id, id));

    return { message: `Tax Concept ${id} deleted successfully` };
  }

  private toResponseDto(concept: typeof taxConcepts.$inferSelect): TaxConceptResponseDto {
    return {
      id: concept.id,
      code: concept.code,
      name: concept.name,
      retentionPercentage: Number(concept.retentionPercentage),
      baseMin: concept.baseMin ? Number(concept.baseMin) : 0,
      sustraendo: concept.sustraendo ? Number(concept.sustraendo) : 0,
      isEnabled: concept.isEnabled || false,
    };
  }
}
