import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { db } from '../../database';
import { partners, invoices, payments, orders } from '../../schema';
import { eq, sql, like, or, ilike } from 'drizzle-orm';
import {
  CreatePartnerDto,
  UpdatePartnerDto,
  PartnerResponseDto,
  PartnerStatsResponseDto,
} from './dto/partners.dto';

@Injectable()
export class PartnersService {
  async findAll(search?: string): Promise<PartnerResponseDto[]> {
    let query = db.select().from(partners);

    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      query = db
        .select()
        .from(partners)
        .where(
          or(
            like(sql`LOWER(${partners.name})`, searchLower),
            like(sql`LOWER(${partners.email})`, searchLower),
            like(sql`LOWER(${partners.taxId})`, searchLower)
          )
        ) as any;
    }

    const allPartners = await query;
    return allPartners.map(this.toResponseDto);
  }

  async findOne(id: string): Promise<PartnerResponseDto> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);

    if (!partner) {
      throw new NotFoundException(`Partner with ID ${id} not found`);
    }

    return this.toResponseDto(partner);
  }

  async create(createPartnerDto: CreatePartnerDto): Promise<PartnerResponseDto> {
    const [existing] = await db
      .select()
      .from(partners)
      .where(eq(partners.taxId, createPartnerDto.taxId))
      .limit(1);

    if (existing) {
      throw new ConflictException('Partner with this tax ID already exists');
    }

    const [newPartner] = await db
      .insert(partners)
      .values({
        name: createPartnerDto.name,
        email: createPartnerDto.email,
        taxId: createPartnerDto.taxId,
        address: createPartnerDto.address,
        phone: createPartnerDto.phone,
        type: createPartnerDto.type || 'CUSTOMER',
        taxpayerType: createPartnerDto.taxpayerType || 'ORDINARY',
        retentionRate: createPartnerDto.retentionRate?.toString() || '0',
        isSpecialTaxpayer: createPartnerDto.isSpecialTaxpayer || false,
        creditLimit: createPartnerDto.creditLimit?.toString() || '0',
        creditDays: createPartnerDto.creditDays ?? 0,
        islrConceptId: createPartnerDto.islrConceptId,
      })
      .returning();

    return this.toResponseDto(newPartner);
  }

  async update(id: string, updatePartnerDto: UpdatePartnerDto): Promise<PartnerResponseDto> {
    const [existing] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Partner with ID ${id} not found`);
    }

    if (updatePartnerDto.taxId && updatePartnerDto.taxId !== existing.taxId) {
      const [conflict] = await db
        .select()
        .from(partners)
        .where(eq(partners.taxId, updatePartnerDto.taxId))
        .limit(1);

      if (conflict) {
        throw new ConflictException('Partner with this tax ID already exists');
      }
    }

    const updateData: Partial<typeof partners.$inferInsert> = {};

    if (updatePartnerDto.name !== undefined) updateData.name = updatePartnerDto.name;
    if (updatePartnerDto.email !== undefined) updateData.email = updatePartnerDto.email;
    if (updatePartnerDto.taxId !== undefined) updateData.taxId = updatePartnerDto.taxId;
    if (updatePartnerDto.address !== undefined) updateData.address = updatePartnerDto.address;
    if (updatePartnerDto.phone !== undefined) updateData.phone = updatePartnerDto.phone;
    if (updatePartnerDto.type !== undefined) updateData.type = updatePartnerDto.type;
    if (updatePartnerDto.taxpayerType !== undefined)
      updateData.taxpayerType = updatePartnerDto.taxpayerType;
    if (updatePartnerDto.retentionRate !== undefined)
      updateData.retentionRate = updatePartnerDto.retentionRate.toString();
    if (updatePartnerDto.isSpecialTaxpayer !== undefined)
      updateData.isSpecialTaxpayer = updatePartnerDto.isSpecialTaxpayer;
    if (updatePartnerDto.creditLimit !== undefined)
      updateData.creditLimit = updatePartnerDto.creditLimit.toString();
    if (updatePartnerDto.creditDays !== undefined)
      updateData.creditDays = updatePartnerDto.creditDays;
    if (updatePartnerDto.islrConceptId !== undefined)
      updateData.islrConceptId = updatePartnerDto.islrConceptId;

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db.update(partners).set(updateData).where(eq(partners.id, id));
    }

    return this.findOne(id);
  }

  /**
   * Baja de un socio de negocio (T-01-17): si tiene documentos asociados responde 409 y
   * sugiere desactivarlo; si no, lo desactiva (baja logica, no se borra la fila).
   */
  async remove(id: string): Promise<{ message: string }> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);

    if (!partner) {
      throw new NotFoundException(`Partner with ID ${id} not found`);
    }

    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.partnerId, id))
      .limit(1);
    const [payment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.partnerId, id))
      .limit(1);
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.partnerId, id))
      .limit(1);

    if (invoice || payment || order) {
      throw new ConflictException(
        'Partner has related documents; deactivate it instead of deleting it'
      );
    }

    await db
      .update(partners)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(partners.id, id));

    return { message: `Partner ${id} deactivated successfully` };
  }

  /** Listado paginado en servidor (T-01-18). */
  async findPaginated(options: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: PartnerResponseDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(options.page ?? 1, 1);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const where = options.search
      ? or(
          ilike(partners.name, `%${options.search}%`),
          ilike(partners.taxId, `%${options.search}%`)
        )
      : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(partners)
      .where(where);

    const rows = await db
      .select()
      .from(partners)
      .where(where)
      .orderBy(partners.name)
      .limit(limit)
      .offset((page - 1) * limit);

    return { data: rows.map(this.toResponseDto), total: Number(count), page, limit };
  }

  async getStats(): Promise<PartnerStatsResponseDto> {
    const stats = await db
      .select({
        type: partners.type,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(partners)
      .groupBy(partners.type);

    const formattedStats: PartnerStatsResponseDto = {
      customer: 0,
      vendor: 0,
      total: 0,
    };

    for (const stat of stats) {
      const type = (stat.type || 'CUSTOMER').toUpperCase();
      if (type === 'CUSTOMER') {
        formattedStats.customer = Number(stat.count);
      } else if (type === 'VENDOR') {
        formattedStats.vendor = Number(stat.count);
      }
    }

    formattedStats.total = formattedStats.customer + formattedStats.vendor;

    return formattedStats;
  }

  private toResponseDto(partner: typeof partners.$inferSelect): PartnerResponseDto {
    return {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      taxId: partner.taxId,
      address: partner.address,
      phone: partner.phone,
      type: partner.type as 'CUSTOMER' | 'VENDOR',
      taxpayerType: partner.taxpayerType as 'ORDINARY' | 'SPECIAL' | 'LEGAL',
      retentionRate: partner.retentionRate ? Number(partner.retentionRate) : 0,
      isSpecialTaxpayer: partner.isSpecialTaxpayer || false,
      creditLimit: partner.creditLimit ? Number(partner.creditLimit) : 0,
      creditDays: partner.creditDays ?? 0,
      islrConceptId: partner.islrConceptId,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
    };
  }
}
