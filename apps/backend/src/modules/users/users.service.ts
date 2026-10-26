import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { db } from '../../database';
import { branches, roles, users, usersBranches, usersRoles } from '../../schema';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  async findAll(): Promise<UserResponseDto[]> {
    const allUsers = await db.select().from(users);
    return Promise.all(allUsers.map(user => this.toResponse(user)));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.toResponse(user);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const password = await bcrypt.hash(dto.password, 10);

    const created = await db.transaction(async tx => {
      const [user] = await tx
        .insert(users)
        .values({ name: dto.name, email: dto.email, password })
        .returning();
      return user;
    });
    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updateData: Partial<typeof users.$inferInsert> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.password !== undefined) updateData.password = await bcrypt.hash(dto.password, 10);
    if (Object.keys(updateData).length) {
      await db
        .update(users)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(users.id, id));
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await db.delete(users).where(eq(users.id, id));
    return { message: `User ${id} deleted successfully` };
  }

  async assignRoles(userId: string, inputRoleIds: string[]): Promise<UserResponseDto> {
    await this.assertUserExists(userId);
    const roleIds = this.uniqueIds(inputRoleIds, 'Role IDs');

    await db.transaction(async tx => {
      if (roleIds.length) {
        const foundRoles = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(inArray(roles.id, roleIds));
        if (foundRoles.length !== roleIds.length) {
          throw new BadRequestException('One or more role IDs do not exist');
        }
      }
      await tx.delete(usersRoles).where(eq(usersRoles.userId, userId));
      if (roleIds.length) {
        await tx.insert(usersRoles).values(roleIds.map(roleId => ({ userId, roleId })));
      }
    });
    return this.findOne(userId);
  }

  async assignBranches(
    userId: string,
    inputBranchIds: string[],
    defaultBranchId?: string
  ): Promise<UserResponseDto> {
    await this.assertUserExists(userId);
    const branchIds = this.uniqueIds(inputBranchIds, 'Branch IDs');
    this.validateDefaultBranch(branchIds, defaultBranchId);

    await db.transaction(async tx => {
      if (branchIds.length) {
        const foundBranches = await tx
          .select({ id: branches.id })
          .from(branches)
          .where(and(inArray(branches.id, branchIds), eq(branches.isActive, true)));
        if (foundBranches.length !== branchIds.length) {
          throw new BadRequestException('One or more branch IDs do not exist or are inactive');
        }
      }
      await tx.delete(usersBranches).where(eq(usersBranches.userId, userId));
      if (branchIds.length) {
        await tx.insert(usersBranches).values(
          branchIds.map(branchId => ({
            userId,
            branchId,
            isDefault: branchId === defaultBranchId,
          }))
        );
      }
    });
    return this.findOne(userId);
  }

  private async assertUserExists(id: string): Promise<void> {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
  }

  private uniqueIds(ids: string[], label: string): string[] {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      throw new BadRequestException(`${label} must not contain duplicates`);
    }
    return unique;
  }

  private validateDefaultBranch(branchIds: string[], defaultBranchId?: string): void {
    if (branchIds.length === 0 && defaultBranchId) {
      throw new BadRequestException('A default branch cannot be set without branch assignments');
    }
    if (branchIds.length > 0 && (!defaultBranchId || !branchIds.includes(defaultBranchId))) {
      throw new BadRequestException('The default branch must be one of the assigned branches');
    }
  }

  private async toResponse(user: typeof users.$inferSelect): Promise<UserResponseDto> {
    const [userRoles, userBranchRows] = await Promise.all([
      db
        .select({ name: roles.name })
        .from(usersRoles)
        .innerJoin(roles, eq(usersRoles.roleId, roles.id))
        .where(eq(usersRoles.userId, user.id)),
      db
        .select({
          id: branches.id,
          name: branches.name,
          companyId: branches.companyId,
          isDefault: usersBranches.isDefault,
        })
        .from(usersBranches)
        .innerJoin(branches, eq(usersBranches.branchId, branches.id))
        .where(eq(usersBranches.userId, user.id)),
    ]);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: userRoles.map(({ name }) => name),
      branches: userBranchRows.map(branch => ({
        ...branch,
        isDefault: branch.isDefault ?? false,
      })),
    };
  }
}
