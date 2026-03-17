// src/modules/auth/dto/auth.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'jordan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MySecurePassword123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'Jordan Kim' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'jordan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class MagicLinkDto {
  @ApiProperty({ example: 'jordan@example.com' })
  @IsEmail()
  email: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class PushTokenDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ enum: ['ios', 'android', 'web'] })
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform: string;
}
