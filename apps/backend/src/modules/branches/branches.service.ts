import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../database';
import { branches, companies, usersBranches } from '../../schema';
import {
  BranchResponseDto,
  CompanyResponseDto,
  CreateBranchDto,
  CreateCompanyDto,
  UpdateBranchDto,
  UpdateCompanyDto,
} from './dto/branches.dto';

@Injectable()
export class BranchesService {
  async findAll(userId?: string): Promise<BranchResponseDto[]> {
    const rows = userId
      ? await db
          .select({ branch: branches, taxId: companies.taxId })
          .from(usersBranches)
          .innerJoin(branches, eq(usersBranches.branchId, branches.id))
          .innerJoin(companies, eq(branches.companyId, companies.id))
          .where(
            and(
              eq(usersBranches.userId, userId),
              eq(branches.isActive, true),
              eq(companies.isActive, true)
            )
          )
      : await db
          .select({ branch: branches, taxId: companies.taxId })
          .from(branches)
          .innerJoin(companies, eq(branches.companyId, companies.id));
    return rows.map(({ branch, taxId }) => this.toResponseDto(branch, taxId));
  }

  async findOne(id: string, userId?: string): Promise<BranchResponseDto> {
    const [row] = userId
      ? await db
          .select({ branch: branches, taxId: companies.taxId })
          .from(usersBranches)
          .innerJoin(branches, eq(usersBranches.branchId, branches.id))
          .innerJoin(companies, eq(branches.companyId, companies.id))
          .where(
            and(
              eq(branches.id, id),
              eq(usersBranches.userId, userId),
              eq(branches.isActive, true),
              eq(companies.isActive, true)
            )
          )
          .limit(1)
      : await db
          .select({ branch: branches, taxId: companies.taxId })
          .from(branches)
          .innerJoin(companies, eq(branches.companyId, companies.id))
          .where(eq(branches.id, id))
          .limit(1);

    if (!row) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    return this.toResponseDto(row.branch, row.taxId);
  }

  async findCompanies(userId?: string): Promise<CompanyResponseDto[]> {
    const accessibleRows = userId
      ? await db
          .select({ company: companies, branch: branches })
          .from(usersBranches)
          .innerJoin(branches, eq(usersBranches.branchId, branches.id))
          .innerJoin(companies, eq(branches.companyId, companies.id))
          .where(
            and(
              eq(usersBranches.userId, userId),
              eq(branches.isActive, true),
              eq(companies.isActive, true)
            )
          )
      : await db
          .select({ company: companies, branch: branches })
          .from(companies)
          .leftJoin(branches, eq(branches.companyId, companies.id));

    const grouped = new Map<string, CompanyResponseDto>();
    for (const { company, branch } of accessibleRows) {
      let group = grouped.get(company.id);
      if (!group) {
        group = {
          id: company.id,
          taxId: company.taxId,
          name: company.name,
          address: company.address,
          phone: company.phone,
          email: company.email,
          isActive: company.isActive,
          branchCount: 0,
          branches: [],
        };
        grouped.set(company.id, group);
      }
      if (branch) {
        group.branches.push(this.toResponseDto(branch, company.taxId));
        group.branchCount += 1;
      }
    }
    return [...grouped.values()];
  }

  async createCompany(dto: CreateCompanyDto): Promise<CompanyResponseDto> {
    await this.assertTaxIdAvailable(dto.taxId);
    const [company] = await db.insert(companies).values(dto).returning();
    return this.toCompanyResponse(company, []);
  }

  async updateCompany(id: string, dto: UpdateCompanyDto): Promise<CompanyResponseDto> {
    const [existing] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    if (!existing) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }
    if (dto.taxId !== undefined && dto.taxId !== existing.taxId) {
      await this.assertTaxIdAvailable(dto.taxId, id);
    }
    const [updated] = await db
      .update(companies)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    const grouped = await this.findCompanyWithBranches(updated);
    return grouped;
  }

  async create(createBranchDto: CreateBranchDto): Promise<BranchResponseDto> {
    await this.assertCompanyActive(createBranchDto.companyId);
    const [newBranch] = await db.insert(branches).values(createBranchDto).returning();
    return this.findOne(newBranch.id);
  }

  async update(id: string, updateBranchDto: UpdateBranchDto): Promise<BranchResponseDto> {
    const [existing] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
    if (!existing) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    if (updateBranchDto.companyId !== undefined) {
      await this.assertCompanyActive(updateBranchDto.companyId);
    }

    const updateData: Partial<typeof branches.$inferInsert> = {};
    if (updateBranchDto.companyId !== undefined) updateData.companyId = updateBranchDto.companyId;
    if (updateBranchDto.name !== undefined) updateData.name = updateBranchDto.name;
    if (updateBranchDto.address !== undefined) updateData.address = updateBranchDto.address;
    if (updateBranchDto.phone !== undefined) updateData.phone = updateBranchDto.phone;
    if (updateBranchDto.email !== undefined) updateData.email = updateBranchDto.email;

    if (Object.keys(updateData).length > 0) {
      await db.update(branches).set(updateData).where(eq(branches.id, id));
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }
    await db.update(branches).set({ isActive: false }).where(eq(branches.id, id));
    return { message: `Branch ${id} deactivated successfully` };
  }

  private async assertCompanyActive(id: string): Promise<void> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    if (!company) {
      throw new BadRequestException(`Company with ID ${id} does not exist`);
    }
    if (!company.isActive) {
      throw new BadRequestException(`Company with ID ${id} is inactive`);
    }
  }

  private async assertTaxIdAvailable(taxId?: string, exceptId?: string): Promise<void> {
    if (!taxId) return;
    const [existing] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        exceptId
          ? and(eq(companies.taxId, taxId), ne(companies.id, exceptId))
          : eq(companies.taxId, taxId)
      )
      .limit(1);
    if (existing) {
      throw new ConflictException(`A company with tax ID ${taxId} already exists`);
    }
  }

  private async findCompanyWithBranches(company: typeof companies.$inferSelect) {
    const rows = await db
      .select({ branch: branches })
      .from(branches)
      .where(eq(branches.companyId, company.id));
    return this.toCompanyResponse(
      company,
      rows.map(({ branch }) => this.toResponseDto(branch, company.taxId))
    );
  }

  private toCompanyResponse(
    company: typeof companies.$inferSelect,
    companyBranches: BranchResponseDto[]
  ): CompanyResponseDto {
    return {
      id: company.id,
      taxId: company.taxId,
      name: company.name,
      address: company.address,
      phone: company.phone,
      email: company.email,
      isActive: company.isActive,
      branchCount: companyBranches.length,
      branches: companyBranches,
    };
  }

  private toResponseDto(
    branch: typeof branches.$inferSelect,
    taxId: string | null
  ): BranchResponseDto {
    return {
      id: branch.id,
      companyId: branch.companyId,
      name: branch.name,
      address: branch.address,
      taxId,
      phone: branch.phone,
      email: branch.email,
      isActive: branch.isActive ?? true,
      createdAt: branch.createdAt,
    };
  }
}
