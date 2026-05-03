import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class GenerateAiRequestDto {
  @ApiPropertyOptional({
    description:
      'Conversation session id from a previous /ai/generate response (short-term memory)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  sessionId?: string;

  @ApiPropertyOptional({
    description:
      'When true and sessionId is set, clears stored turns before this call',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  resetContext?: boolean;

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

  @ApiProperty({
    description:
      'Send this value back as sessionId on the next request to continue the dialogue',
    format: 'uuid',
  })
  sessionId!: string;
}
