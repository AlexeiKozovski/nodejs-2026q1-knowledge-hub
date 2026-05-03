import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { AnalyzeSeverityDto } from './analyze-article.dto';

export class GeminiJsonAnalyzeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500_000)
  analysis!: string;

  @IsArray()
  @ArrayMaxSize(24)
  @IsString({ each: true })
  @MaxLength(8_000, { each: true })
  suggestions!: string[];

  @IsIn(['info', 'warning', 'error'])
  severity!: AnalyzeSeverityDto;
}
