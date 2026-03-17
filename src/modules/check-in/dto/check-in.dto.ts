// src/modules/check-in/dto/check-in.dto.ts
import {
  IsInt,
  Min,
  Max,
  IsArray,
  IsString,
  IsOptional,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckInDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt() @Min(0) @Max(100)
  mood: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt() @Min(0) @Max(100)
  anxiety: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt() @Min(0) @Max(100)
  energy: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt() @Min(0) @Max(100)
  clarity: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt() @Min(0) @Max(100)
  sleepQuality: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100)
  motivation?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100)
  socialConnection?: number;

  @ApiProperty({ type: [String] })
  @IsArray() @IsString({ each: true }) @ArrayMaxSize(12)
  stressTags: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
