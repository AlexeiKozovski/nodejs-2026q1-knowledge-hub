import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ example: 'Introduction to NestJS' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'NestJS is a progressive Node.js framework...' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
