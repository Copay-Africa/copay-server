import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, IsDateString } from 'class-validator';

export class AssignRoomDto {
  @ApiProperty({
    description: 'User ID to assign to the room',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId()
  userId: string;

  @ApiPropertyOptional({
    description: 'Assignment start date (ISO string, defaults to now)',
    example: '2025-11-19T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Assignment end date (ISO string, leave empty for indefinite)',
    example: '2026-11-19T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Assignment notes',
    example: 'New tenant, security deposit paid',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UnassignRoomDto {
  @ApiPropertyOptional({
    description: 'Assignment end date (ISO string, defaults to now)',
    example: '2025-11-19T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Reason for unassignment',
    example: 'Tenant moved out',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
