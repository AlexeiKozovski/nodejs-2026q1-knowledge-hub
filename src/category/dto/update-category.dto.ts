import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Guides' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'How-to articles' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;
}
