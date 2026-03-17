// src/modules/medications/dto/medication.dto.ts
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const FREQUENCIES = [
  'daily',
  'twice_daily',
  'three_times_daily',
  'weekly',
  'as_needed',
] as const;

export class CreateMedicationDto {
  @ApiProperty() @IsString() name: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber() @Min(0.01) @Max(100000)
  doseMg?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() doseUnit?: string;

  @ApiProperty({ enum: FREQUENCIES })
  @IsString() @IsIn(FREQUENCIES)
  frequency: string;

  @ApiProperty({ type: [String], example: ['08:00'] })
  @IsArray() @IsString({ each: true })
  reminderTimes: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() refillDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class LogMedicationDto {
  @ApiProperty({ enum: ['taken', 'skipped', 'snoozed'] })
  @IsString() @IsIn(['taken', 'skipped', 'snoozed'])
  status: string;

  @ApiProperty() @IsString() scheduledAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
