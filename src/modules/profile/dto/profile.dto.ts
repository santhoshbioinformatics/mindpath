// src/modules/profile/dto/profile.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray()
  primaryGoals?: string[];
}

export class CreateGoalDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({
    enum: ['wellbeing', 'career', 'social', 'health', 'personal', 'financial'],
  })
  @IsString()
  @IsIn(['wellbeing', 'career', 'social', 'health', 'personal', 'financial'])
  category: string;

  @ApiPropertyOptional() @IsOptional() @IsString() targetDate?: string;
}

export class CreateTrustedContactDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() relation: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class UpdateNotifPrefsDto {
  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional() @IsString()
  checkInTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() checkInEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() medicationEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() weeklyReportEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() streakEnabled?: boolean;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional() @IsString()
  quietHoursStart?: string;

  @ApiPropertyOptional({ example: '07:00' })
  @IsOptional() @IsString()
  quietHoursEnd?: string;
}
