import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';

export class CooperativeRoomDto {
  @ApiProperty({
    description: 'Room ID',
    example: '507f1f77bcf86cd799439014',
  })
  id: string;

  @ApiProperty({
    description: 'Room number or identifier',
    example: '101',
  })
  roomNumber: string;

  @ApiPropertyOptional({
    description: 'Room type',
    example: '1BR',
  })
  roomType?: string;

  @ApiPropertyOptional({
    description: 'Floor',
    example: '1st Floor',
  })
  floor?: string;

  @ApiPropertyOptional({
    description: 'Block or building section',
    example: 'Block A',
  })
  block?: string;

  @ApiProperty({
    description: 'Room status',
    enum: RoomStatus,
  })
  status: RoomStatus;

  @ApiPropertyOptional({
    description: 'Monthly rent amount',
    example: 500.0,
  })
  baseRent?: number;

  @ApiPropertyOptional({
    description: 'Security deposit required',
    example: 1000.0,
  })
  deposit?: number;

  @ApiProperty({
    description: 'Whether user is currently assigned to this room',
    example: true,
  })
  isUserAssigned: boolean;

  @ApiPropertyOptional({
    description: 'Assignment start date (if user is assigned)',
  })
  assignmentStartDate?: Date;
}
