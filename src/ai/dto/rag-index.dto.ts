import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ReindexRequestDto {
  @ApiPropertyOptional({
    description: 'When true, indexes only published articles',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  onlyPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Optional list of article ids for selective reindex',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  articleIds?: string[];
}

export class ReindexResponseDto {
  @ApiProperty()
  indexedArticles!: number;

  @ApiProperty()
  indexedChunks!: number;

  @ApiProperty()
  vectorCollection!: string;
}
