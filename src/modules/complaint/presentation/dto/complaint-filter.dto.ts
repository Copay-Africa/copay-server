import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus, ComplaintPriority } from '@prisma/client';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class ComplaintFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by complaint status',
    enum: ComplaintStatus,
    example: ComplaintStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @ApiPropertyOptional({
    description: 'Filter by complaint priority',
    enum: ComplaintPriority,
    example: ComplaintPriority.HIGH,
  })
  @IsOptional()
  @IsEnum(ComplaintPriority)
  priority?: ComplaintPriority;

  @ApiPropertyOptional({
    description: 'Filter by user ID (for admin queries)',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter complaints created from this date',
    example: '2025-10-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter complaints created until this date',
    example: '2025-10-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}