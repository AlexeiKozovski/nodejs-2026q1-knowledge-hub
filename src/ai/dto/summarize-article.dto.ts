import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum SummaryMaxLength {
  SHORT = 'short',
  MEDIUM = 'medium',
  DETAILED = 'detailed',
}

export class SummarizeArticleRequestDto {
  @ApiPropertyOptional({
    enum: SummaryMaxLength,
    default: SummaryMaxLength.MEDIUM,
  })
  @IsOptional()
  @IsEnum(SummaryMaxLength)
  maxLength?: SummaryMaxLength;
}

export class SummarizeArticleResponseDto {
  @ApiProperty()
  articleId!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty()
  originalLength!: number;

  @ApiProperty()
  summaryLength!: number;
}
