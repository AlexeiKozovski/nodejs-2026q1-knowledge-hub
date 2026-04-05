import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ example: 'jdoe' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'secret' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
