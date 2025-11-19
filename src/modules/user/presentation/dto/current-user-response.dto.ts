import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus, CooperativeStatus } from '@prisma/client';
import { CooperativeRoomDto } from './cooperative-room.dto';

// Re-export CooperativeRoomDto for convenience
export { CooperativeRoomDto } from './cooperative-room.dto';

export class CooperativeDetailsDto {
  @ApiProperty({
    description: 'Cooperative ID',
  })
  id: string;

  @ApiProperty({
    description: 'Cooperative name',
    example: 'Savings Cooperative Ltd',
  })
  name: string;

  @ApiProperty({
    description: 'Cooperative code',
    example: 'SCL001',
  })
  code: string;

  @ApiProperty({
    description: 'Cooperative status',
    enum: CooperativeStatus,
  })
  status: CooperativeStatus;

  @ApiPropertyOptional({
    description: 'Rooms in this cooperative',
    type: [CooperativeRoomDto],
  })
  rooms?: CooperativeRoomDto[];
}

export class CurrentUserResponseDto {
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
    description: 'Cooperative details',
    type: CooperativeDetailsDto,
  })
  cooperative?: CooperativeDetailsDto;

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
