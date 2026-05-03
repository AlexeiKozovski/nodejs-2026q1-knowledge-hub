import { IsString, MaxLength, MinLength } from 'class-validator';

export class GeminiJsonTranslateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500_000)
  translatedText!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  detectedLanguage!: string;
}
