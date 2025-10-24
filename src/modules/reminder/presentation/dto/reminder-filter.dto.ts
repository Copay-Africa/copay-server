import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderType, ReminderStatus } from '@prisma/client';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class ReminderFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by reminder type',
    enum: ReminderType,
    example: ReminderType.PAYMENT_DUE,
  })
  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @ApiPropertyOptional({
    description: 'Filter by reminder status',
    enum: ReminderStatus,
    example: ReminderStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @ApiPropertyOptional({
    description: 'Filter by payment type ID',
    example: '507f1f77bcf86cd799439014',
  })
  @IsOptional()
  @IsString()
  paymentTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filter reminders from this date (ISO 8601)',
    example: '2025-11-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter reminders to this date (ISO 8601)',
    example: '2025-11-30T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter only recurring reminders',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter only due reminders (reminders that should trigger now or in the past)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isDue?: boolean;
}
