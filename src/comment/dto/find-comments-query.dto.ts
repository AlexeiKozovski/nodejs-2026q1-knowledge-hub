import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class FindCommentsQueryDto {
  @ApiProperty({ format: 'uuid', description: 'Article id (required)' })
  @IsNotEmpty()
  @IsUUID('4')
  articleId!: string;
}
