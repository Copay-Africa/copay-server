import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';

export class RoomResponseDto {
  @ApiProperty({
    description: 'Room ID',
    example: '507f1f77bcf86cd799439014',
  })
  id: string;

  @ApiProperty({
    description: 'Room/unit number',
    example: '101',
  })
  roomNumber: string;

  @ApiPropertyOptional({
    description: 'Type of room/unit',
    example: '1BR',
  })
  roomType?: string;

  @ApiPropertyOptional({
    description: 'Floor number or identifier',
    example: '1st Floor',
  })
  floor?: string;

  @ApiPropertyOptional({
    description: 'Building block or section',
    example: 'Block A',
  })
  block?: string;

  @ApiPropertyOptional({
    description: 'Additional room description',
    example: 'Corner unit with balcony',
  })
  description?: string;

  @ApiProperty({
    description: 'Room status',
    enum: RoomStatus,
  })
  status: RoomStatus;

  @ApiPropertyOptional({
    description: 'Monthly rent amount',
    example: 50000,
  })
  baseRent?: number;

  @ApiPropertyOptional({
    description: 'Security deposit required',
    example: 100000,
  })
  deposit?: number;

  @ApiProperty({
    description: 'Cooperative information',
  })
  cooperative: {
    id: string;
    name: string;
    code: string;
    status: string;
  };

  @ApiPropertyOptional({
    description: 'Current tenant information (if occupied)',
  })
  currentTenant?: {
    id: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    assignedAt: Date;
    startDate: Date;
  };

  @ApiPropertyOptional({
    description: 'Room specifications',
  })
  specifications?: Record<string, any>;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
