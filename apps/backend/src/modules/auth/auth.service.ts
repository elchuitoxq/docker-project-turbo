import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db } from '../../database';
import {
  branches,
  companies,
  permissions,
  roles,
  rolesPermissions,
  users,
  usersBranches,
  usersRoles,
} from '../../schema';
import { eq, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { LoginDto, AuthResponseDto, ForgotPasswordResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

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
      expiresIn: 604800,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        permissions: userPermissions,
        branches: userBranches,
      },
    };
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponseDto> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      return {
        message: 'If an account exists with this email, a password reset link will be sent.',
      };
    }

    const mockToken = `mock-token-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log(`[MOCK] Password reset requested for ${email}`);
    console.log(`[MOCK] Reset token: ${mockToken}`);
    console.log(`[MOCK] In production, this would send an email with the reset link.`);

    return {
      message: 'If an account exists with this email, a password reset link will be sent.',
      mockUrl: `http://localhost:3000/reset-password?token=${mockToken}`,
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (!token.startsWith('mock-token-')) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    console.log(`[MOCK] Password reset with token: ${token}`);
    console.log(`[MOCK] New password would be set to: ${newPassword}`);
    console.log(`[MOCK] In production, this would update the user's password.`);

    return {
      message: 'Password has been reset successfully.',
    };
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
}
