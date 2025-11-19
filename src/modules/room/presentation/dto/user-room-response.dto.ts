import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';

export class UserRoomResponseDto {
  @ApiProperty({
    description: 'Assignment ID',
    example: '507f1f77bcf86cd799439015',
  })
  id: string;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };

  @ApiProperty({
    description: 'Cooperative information',
  })
  cooperative: {
    id: string;
    name: string;
    code: string;
    status: string;
  };

  @ApiProperty({
    description: 'Room information',
  })
  room: {
    id: string;
    roomNumber: string;
    roomType?: string;
    floor?: string;
    block?: string;
    status: RoomStatus;
    baseRent?: number;
    deposit?: number;
  };

  @ApiProperty({
    description: 'Assignment start date',
  })
  startDate: Date;

  @ApiPropertyOptional({
    description: 'Assignment end date',
  })
  endDate?: Date;

  @ApiProperty({
    description: 'Whether assignment is currently active',
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Assignment notes',
  })
  notes?: string;

  @ApiProperty({
    description: 'When assignment was created',
  })
  assignedAt: Date;

  @ApiPropertyOptional({
    description: 'ID of admin who assigned the room',
  })
  assignedBy?: string;

  @ApiProperty({
    description: 'Assignment creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Assignment last update timestamp',
  })
  updatedAt: Date;
}
