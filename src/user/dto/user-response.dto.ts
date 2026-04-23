import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../types';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  login!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  createdAt!: number;

  @ApiProperty()
  updatedAt!: number;
}
