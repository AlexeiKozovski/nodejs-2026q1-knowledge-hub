import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'project' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'interesting project' })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
