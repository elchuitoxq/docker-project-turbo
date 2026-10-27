import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { db } from '../../database';
import {
  branches,
  companies,
  passwordResetTokens,
  permissions,
  roles,
  rolesPermissions,
  users,
  usersBranches,
  usersRoles,
} from '../../schema';
import {
  LoginDto,
  AuthResponseDto,
  AuthUserResponseDto,
  ForgotPasswordResponseDto,
} from './dto/auth.dto';
import { PasswordResetNotifier } from './password-reset.notifier';

const GENERIC_FORGOT_MESSAGE =
  'If an account exists with this email, a password reset link will be sent.';
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Convierte una expresión tipo `7d`, `12h`, `30m` o `3600` a segundos. */
function parseTtlSeconds(raw: string): number {
  const match = /^(\d+)([smhd])?$/.exec(raw.trim());
  if (!match) return 604800;
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly notifier: PasswordResetNotifier
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const [user] = await db.select().from(users).where(eq(users.email, loginDto.email)).limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRoles = await db
      .select({
        roleId: usersRoles.roleId,
        roleName: roles.name,
      })
      .from(usersRoles)
      .innerJoin(roles, eq(usersRoles.roleId, roles.id))
      .where(eq(usersRoles.userId, user.id));

    const roleIds = userRoles.map(ur => ur.roleId);

    let userPermissions: string[] = [];
    if (roleIds.length > 0) {
      const perms = await db
        .select({ code: permissions.code })
        .from(rolesPermissions)
        .innerJoin(permissions, eq(rolesPermissions.permissionId, permissions.id))
        .where(inArray(rolesPermissions.roleId, roleIds));

      userPermissions = [...new Set(perms.map(p => p.code))];
    }

    const userBranches = await db
      .select({
        id: branches.id,
        name: branches.name,
        companyId: branches.companyId,
        taxId: companies.taxId,
        isDefault: usersBranches.isDefault,
      })
      .from(usersBranches)
      .innerJoin(branches, eq(usersBranches.branchId, branches.id))
      .innerJoin(companies, eq(branches.companyId, companies.id))
      .where(eq(usersBranches.userId, user.id));

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      roles: userRoles.map(ur => ur.roleName),
      permissions: userPermissions,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.tokenTtlSeconds(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        permissions: userPermissions,
        branches: userBranches.map(({ isDefault: _isDefault, ...branch }) => branch),
        defaultBranchId: this.pickDefaultBranch(userBranches),
      },
    };
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponseDto> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Respuesta idéntica exista o no el usuario (evita enumeración de cuentas).
    if (!user) {
      return { message: GENERIC_FORGOT_MESSAGE };
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    // Solo puede haber un token pendiente por usuario.
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });

    const devUrl = await this.notifier.send(user.email, rawToken);

    return {
      message: GENERIC_FORGOT_MESSAGE,
      ...(devUrl ? { mockUrl: devUrl } : {}),
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const [record] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hashToken(token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!record) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db
      .update(users)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(users.id, record.userId));

    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, record.id));

    // Cualquier otro token pendiente del usuario queda invalidado.
    await db
      .delete(passwordResetTokens)
      .where(
        and(eq(passwordResetTokens.userId, record.userId), isNull(passwordResetTokens.usedAt))
      );

    this.logger.log(`Contraseña restablecida para el usuario ${record.userId}`);

    return {
      message: 'Password has been reset successfully.',
    };
  }

  async getProfile(userId: string): Promise<AuthUserResponseDto> {
    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const perms = await db
      .select({ code: permissions.code })
      .from(usersRoles)
      .innerJoin(rolesPermissions, eq(usersRoles.roleId, rolesPermissions.roleId))
      .innerJoin(permissions, eq(rolesPermissions.permissionId, permissions.id))
      .where(eq(usersRoles.userId, userId));

    const userBranches = await db
      .select({
        id: branches.id,
        name: branches.name,
        companyId: branches.companyId,
        taxId: companies.taxId,
        isDefault: usersBranches.isDefault,
      })
      .from(usersBranches)
      .innerJoin(branches, eq(usersBranches.branchId, branches.id))
      .innerJoin(companies, eq(branches.companyId, companies.id))
      .where(eq(usersBranches.userId, userId));

    return {
      ...user,
      permissions: [...new Set(perms.map(p => p.code))],
      branches: userBranches.map(({ isDefault: _isDefault, ...branch }) => branch),
      defaultBranchId: this.pickDefaultBranch(userBranches),
    };
  }

  /**
   * Sucursal con la que debe arrancar la UI: la marcada como predeterminada
   * o, si no hay ninguna, la primera asignada.
   */
  private pickDefaultBranch(
    userBranches: Array<{ id: string; isDefault: boolean }>
  ): string | null {
    const preferred = userBranches.find(({ isDefault }) => isDefault);
    return preferred?.id ?? userBranches[0]?.id ?? null;
  }

  async validateUser(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user;
  }

  private tokenTtlSeconds(): number {
    return parseTtlSeconds(this.config.get<string>('JWT_EXPIRES_IN') ?? '7d');
  }
}
