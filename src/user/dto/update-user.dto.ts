import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../../types';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @ValidateIf((o: UpdateUserDto) => o.newPassword !== undefined)
  @IsString()
  @IsNotEmpty()
  oldPassword?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateUserDto) => o.oldPassword !== undefined)
  @IsString()
  @IsNotEmpty()
  newPassword?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
