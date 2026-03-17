// src/modules/assessments/dto/assessment.dto.ts
import { IsString, IsObject, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const VALID_TYPES = [
  'mood',
  'anxiety',
  'stress',
  'cognition',
  'life_satisfaction',
  'life_progress',
  'pain',
  'addiction',
  'memory',
  'suicidality',
] as const;

export class CreateAssessmentDto {
  @ApiProperty({ enum: VALID_TYPES })
  @IsString()
  @IsIn(VALID_TYPES)
  assessmentType: string;

  @ApiProperty({ example: { q1: 2, q2: 1 } })
  @IsObject()
  rawAnswers: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}
