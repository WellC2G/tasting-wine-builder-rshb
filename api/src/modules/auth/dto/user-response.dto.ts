import { ApiProperty } from '@nestjs/swagger';

import { User, UserRole } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'sommelier@tasting.ru' })
  email!: string;

  @ApiProperty({ example: 'Главный Сомелье' })
  name!: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.HOST,
  })
  role!: UserRole;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
