import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../types';

export class CreateUserDto {
  @ApiProperty({ example: 'jdoe' })
  @IsString()
  @IsNotEmpty()
  login!: string;

  @ApiProperty({ example: 'secret' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.VIEWER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
