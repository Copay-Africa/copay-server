import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsMongoId,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderType, ReminderStatus } from '@prisma/client';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';
import { Transform } from 'class-transformer';

export class ReminderSearchDto extends PaginationDto {
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
    description: 'Filter by cooperative ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString()
  @IsMongoId()
  cooperativeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsString()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment type ID',
    example: '507f1f77bcf86cd799439014',
  })
  @IsOptional()
  @IsString()
  @IsMongoId()
  paymentTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by recurring reminders only',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Filter reminders created from this date',
    example: '2025-10-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter reminders created until this date',
    example: '2025-10-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter reminders scheduled from this date',
    example: '2025-11-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  reminderFromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter reminders scheduled until this date',
    example: '2025-11-30T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  reminderToDate?: string;
}
