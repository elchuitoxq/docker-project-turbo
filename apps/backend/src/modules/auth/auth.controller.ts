import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipBranch } from '../../common/decorators/skip-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MessageResponseDto } from '../../common/dto/api-response.dto';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { buildAuthCookie, buildClearedAuthCookie } from './auth.cookie';
import {
  LoginDto,
  AuthResponseDto,
  AuthUserResponseDto,
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly audit: AuditService
  ) {}

  private get cookieSecure(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticates a user, devuelve el JWT y además lo deja en una cookie httpOnly.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() request: Request
  ): Promise<AuthResponseDto> {
    let result: AuthResponseDto;

    try {
      result = await this.authService.login(loginDto);
    } catch (error) {
      // Un intento fallido es parte del rastro de seguridad: quién, desde dónde y cuándo.
      void this.audit.record({
        entityTable: 'users',
        action: 'LOGIN_FAILED',
        actionLabel: 'Intentó iniciar sesión',
        entityLabel: 'sesión',
        module: 'auth',
        result: 'DENIED',
        actorEmail: loginDto.email,
        ipAddress: request.ip ?? null,
        userAgent: request.headers['user-agent'] ?? null,
        httpMethod: 'POST',
        route: '/v1/auth/login',
        description: `Intento fallido de inicio de sesión para ${loginDto.email}`,
      });
      throw error;
    }

    void this.audit.record({
      entityTable: 'users',
      entityId: result.user.id,
      action: 'LOGIN',
      actionLabel: 'Inició sesión',
      entityLabel: 'sesión',
      module: 'auth',
      userId: result.user.id,
      actorName: result.user.name,
      actorEmail: result.user.email,
      ipAddress: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
      httpMethod: 'POST',
      route: '/v1/auth/login',
      description: `${result.user.name} inició sesión`,
    });

    res.setHeader(
      'Set-Cookie',
      buildAuthCookie(result.accessToken, result.expiresIn, this.cookieSecure)
    );
    return result;
  }

  @Get('me')
  // El arranque de la UI ocurre antes de elegir sucursal: devuelve las asignadas.
  @SkipBranch()
  @ApiBearerAuth()
  @ApiCookieAuth('cookie-auth')
  @ApiOperation({
    summary: 'Perfil del usuario autenticado',
    description: 'Devuelve el usuario de la sesión con sus roles, permisos y sucursales asignadas',
  })
  @ApiResponse({ status: 200, type: AuthUserResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async me(@CurrentUser('id') userId: string): Promise<AuthUserResponseDto> {
    return this.authService.getProfile(userId);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cierra la sesión (borra la cookie)',
    description: 'Invalida la cookie `erp_token` del navegador. No requiere token válido',
  })
  @ApiResponse({ status: 204, description: 'Sesión cerrada' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.setHeader('Set-Cookie', buildClearedAuthCookie(this.cookieSecure));
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a password reset email to the user. MOCK: In development, returns a mock URL with the reset token.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent (or mock URL in development)',
    type: ForgotPasswordResponseDto,
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto
  ): Promise<ForgotPasswordResponseDto> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Resets the user password using a valid reset token. MOCK: Accepts any mock token in development.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password has been reset successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired token',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }
}
