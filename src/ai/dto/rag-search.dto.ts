import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ArticleStatus } from '../../types';

export class RagSearchRequestDto {
  @ApiProperty({
    description: 'Search query text',
    minLength: 1,
    maxLength: 4000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  query!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of search results',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional({ enum: ArticleStatus })
  @IsOptional()
  @IsEnum(ArticleStatus)
  articleStatus?: ArticleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tags?: string[];
}

export class RagSearchResultDto {
  @ApiProperty()
  articleId!: string;

  @ApiProperty()
  articleTitle!: string;

  @ApiProperty()
  chunk!: string;

  @ApiProperty()
  similarity!: number;
}

export class RagSearchResponseDto {
  @ApiProperty({ type: [RagSearchResultDto] })
  results!: RagSearchResultDto[];
}
