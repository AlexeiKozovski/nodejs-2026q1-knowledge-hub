import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class GenerateAiRequestDto {
  @ApiProperty({
    description: 'User prompt for open-ended generation',
    minLength: 1,
    maxLength: 32000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(32000)
  prompt!: string;

  @ApiPropertyOptional({
    description:
      'Optional system-style instruction (prepended in the template)',
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemInstruction?: string;

  @ApiPropertyOptional({
    description: 'Rough max output tokens (best-effort)',
    minimum: 64,
    maximum: 8192,
    default: 2048,
  })
  @IsOptional()
  @IsInt()
  @Min(64)
  @Max(8192)
  maxOutputTokens?: number;
}

export class GenerateAiResponseDto {
  @ApiProperty()
  text!: string;
}
