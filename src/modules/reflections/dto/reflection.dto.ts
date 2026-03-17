// src/modules/reflections/dto/reflection.dto.ts
import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReflectionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() wentWell?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() wasDifficult?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() learned?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mattersNow?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tomorrowPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() freeText?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
}
