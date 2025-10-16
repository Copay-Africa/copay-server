import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
  })
  id: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+250788123456',
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'First name',
    example: 'John',
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Doe',
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  email?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
  })
  role: UserRole;

  @ApiProperty({
    description: 'User status',
    enum: UserStatus,
  })
  status: UserStatus;

  @ApiPropertyOptional({
    description: 'Cooperative ID',
  })
  cooperativeId?: string;

  @ApiPropertyOptional({
    description: 'Last login timestamp',
  })
  lastLoginAt?: Date;

  @ApiProperty({
    description: 'Account creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
