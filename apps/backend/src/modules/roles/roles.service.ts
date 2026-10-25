import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../database';
import { permissions, roles, rolesPermissions, usersRoles } from '../../schema';
import { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  async findAll(): Promise<RoleResponseDto[]> {
    const allRoles = await db.select().from(roles).orderBy(asc(roles.name));
    return Promise.all(allRoles.map((role) => this.toResponse(role)));
  }

  async findPermissions() {
    return db.select().from(permissions).orderBy(asc(permissions.module), asc(permissions.code));
  }

  async findOne(id: string): Promise<RoleResponseDto> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!role) throw new NotFoundException(`Role with ID ${id} not found`);
    return this.toResponse(role);
  }

  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    await this.assertNameAvailable(dto.name);
    const permissionIds = this.uniquePermissionIds(dto.permissionIds ?? []);
    const role = await db.transaction(async (tx) => {
      if (permissionIds.length) {
        await this.assertPermissionsExist(tx, permissionIds);
      }
      const [created] = await tx
        .insert(roles)
        .values({ name: dto.name, description: dto.description, isSystem: false })
        .returning();
      if (permissionIds.length) {
        await tx.insert(rolesPermissions).values(permissionIds.map((permissionId) => ({
          roleId: created.id,
          permissionId,
        })));
      }
      return created;
    });
    return this.toResponse(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) throw new NotFoundException(`Role with ID ${id} not found`);
    if (existing.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
    }
    if (dto.name !== undefined && dto.name !== existing.name) {
      await this.assertNameAvailable(dto.name, id);
    }
    const permissionIds =
      dto.permissionIds === undefined ? undefined : this.uniquePermissionIds(dto.permissionIds);

    await db.transaction(async (tx) => {
      if (permissionIds !== undefined) {
        await this.assertPermissionsExist(tx, permissionIds);
        await tx.delete(rolesPermissions).where(eq(rolesPermissions.roleId, id));
        if (permissionIds.length) {
          await tx.insert(rolesPermissions).values(permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })));
        }
      }
      if (dto.name !== undefined || dto.description !== undefined) {
        await tx
          .update(roles)
          .set({ name: dto.name, description: dto.description })
          .where(eq(roles.id, id));
      }
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!role) throw new NotFoundException(`Role with ID ${id} not found`);
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');

    const [assignment] = await db
      .select({ userId: usersRoles.userId })
      .from(usersRoles)
      .where(eq(usersRoles.roleId, id))
      .limit(1);
    if (assignment) {
      throw new ConflictException('Role is assigned to one or more users');
    }
    await db.delete(roles).where(eq(roles.id, id));
    return { message: `Role ${id} deleted successfully` };
  }

  private async toResponse(role: typeof roles.$inferSelect): Promise<RoleResponseDto> {
    const grants = await db
      .select({ permission: permissions })
      .from(rolesPermissions)
      .innerJoin(permissions, eq(rolesPermissions.permissionId, permissions.id))
      .where(eq(rolesPermissions.roleId, role.id))
      .orderBy(asc(permissions.code));
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: grants.map(({ permission }) => permission),
    };
  }

  private uniquePermissionIds(ids: string[]): string[] {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      throw new BadRequestException('Permission IDs must not contain duplicates');
    }
    return unique;
  }

  private async assertNameAvailable(name: string, exceptId?: string): Promise<void> {
    const [existing] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`Role ${name} already exists`);
    }
  }

  private async assertPermissionsExist(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    ids: string[]
  ): Promise<void> {
    const found = await tx.select({ id: permissions.id }).from(permissions).where(
      inArray(permissions.id, ids)
    );
    if (found.length !== ids.length) {
      throw new BadRequestException('One or more permission IDs do not exist');
    }
  }
}
