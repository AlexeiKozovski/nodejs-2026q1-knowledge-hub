import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum AnalyzeArticleTask {
  REVIEW = 'review',
  BUGS = 'bugs',
  OPTIMIZE = 'optimize',
  EXPLAIN = 'explain',
}

export class AnalyzeArticleRequestDto {
  @ApiPropertyOptional({
    enum: AnalyzeArticleTask,
    default: AnalyzeArticleTask.REVIEW,
  })
  @IsOptional()
  @IsEnum(AnalyzeArticleTask)
  task?: AnalyzeArticleTask;
}

export type AnalyzeSeverityDto = 'info' | 'warning' | 'error';

export class AnalyzeArticleResponseDto {
  @ApiProperty()
  articleId!: string;

  @ApiProperty()
  analysis!: string;

  @ApiProperty({ type: [String] })
  suggestions!: string[];

  @ApiProperty({ enum: ['info', 'warning', 'error'] })
  severity!: AnalyzeSeverityDto;

  @ApiPropertyOptional({
    description:
      'When false, the JSON failed class-validator checks and tolerant parsing was used',
  })
  schemaValidated?: boolean;
}
