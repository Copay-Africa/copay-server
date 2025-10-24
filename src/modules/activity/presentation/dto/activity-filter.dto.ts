import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class ActivityFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by activity type',
    enum: ActivityType,
    example: ActivityType.PAYMENT_INITIATED,
  })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ApiPropertyOptional({
    description: 'Filter by cooperative ID',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsString()
  cooperativeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter activities from this date (ISO 8601)',
    example: '2025-10-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter activities to this date (ISO 8601)',
    example: '2025-10-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter only security events',
    example: false,
  })
  @IsOptional()
  isSecurityEvent?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by risk level',
    example: 'HIGH',
    enum: ['LOW', 'MEDIUM', 'HIGH'],
  })
  @IsOptional()
  @IsString()
  riskLevel?: string;
}
