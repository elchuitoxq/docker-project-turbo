import { Controller, Post, Get, Body, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipBranch } from '../../common/decorators/skip-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
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
    private readonly config: ConfigService
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
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(loginDto);
    res.setHeader(
      'Set-Cookie',
      buildAuthCookie(result.accessToken, result.expiresIn, this.cookieSecure)
    );
    return result;
  }

  @Get('me')
  // El arranque de la UI ocurre antes de elegir sucursal: devuelve las asignadas.
  @SkipBranch()
  @ApiCookieAuth('cookie-auth')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  @ApiResponse({ status: 200, type: AuthUserResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async me(@CurrentUser('id') userId: string): Promise<AuthUserResponseDto> {
    return this.authService.getProfile(userId);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cierra la sesión (borra la cookie)' })
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
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired token',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }
}
