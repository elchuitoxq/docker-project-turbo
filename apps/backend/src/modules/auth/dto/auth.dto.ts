import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@empresa.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@empresa.com',
    format: 'email',
  })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Reset token received via email',
    example: 'abc123xyz789',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password',
    example: 'newPassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class AuthBranchDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  taxId: string | null;
}

export class AuthUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [String] })
  permissions: string[];

  @ApiProperty({ type: [AuthBranchDto] })
  branches: AuthBranchDto[];
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  tokenType: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 604800,
  })
  expiresIn: number;

  @ApiProperty({ description: 'User information', type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'If an account exists with this email, a password reset link will be sent.',
  })
  message: string;

  @ApiProperty({
    description: 'Enlace de recuperación. Solo se incluye fuera de producción (desarrollo local).',
    example: 'http://localhost:3000/reset-password?token=2f1c...',
    required: false,
  })
  mockUrl?: string;
}
