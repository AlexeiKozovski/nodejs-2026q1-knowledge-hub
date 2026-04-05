import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great write-up!' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  @IsNotEmpty()
  articleId!: string;
}
