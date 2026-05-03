import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TranslateArticleRequestDto {
  @ApiProperty({
    example: 'en',
    description: 'Target language (ISO 639-1 code or BCP-47 tag)',
  })
  @IsString()
  @IsNotEmpty({ message: 'targetLanguage should not be empty' })
  @MinLength(2)
  @MaxLength(32)
  targetLanguage!: string;

  @ApiPropertyOptional({
    example: 'ru',
    description:
      'Optional source language hint (ISO 639-1 or BCP-47). If omitted, the model detects the source.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  sourceLanguage?: string;
}

export class TranslateArticleResponseDto {
  @ApiProperty()
  articleId!: string;

  @ApiProperty()
  translatedText!: string;

  @ApiProperty({
    description:
      'Detected or inferred source language code of the original article text',
  })
  detectedLanguage!: string;
}
