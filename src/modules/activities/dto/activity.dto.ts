// src/modules/activities/dto/activity.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ACTIVITY_TYPES = [
  'sleep',
  'exercise',
  'meal',
  'work',
  'social',
  'mindfulness',
  'therapy',
  'substance',
  'custom',
] as const;

export class CreateActivityDto {
  @ApiProperty({ enum: ACTIVITY_TYPES })
  @IsString()
  @IsIn(ACTIVITY_TYPES)
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMins?: number;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high'])
  intensity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
