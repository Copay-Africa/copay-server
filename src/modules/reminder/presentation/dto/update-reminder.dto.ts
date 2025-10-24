import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderType, ReminderStatus, NotificationType } from '@prisma/client';

export class UpdateReminderDto {
  @ApiPropertyOptional({
    description: 'Title for the reminder',
    example: 'Monthly Rent Payment',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional description for the reminder',
    example: 'Remember to pay rent before the due date',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Type of reminder',
    enum: ReminderType,
    example: ReminderType.PAYMENT_DUE,
  })
  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @ApiPropertyOptional({
    description: 'Payment type ID for payment-related reminders',
    example: 'clm3kj5k3000201h5b1c2d3e4',
  })
  @IsOptional()
  @IsString()
  paymentTypeId?: string;

  @ApiPropertyOptional({
    description: 'Reminder status',
    enum: ReminderStatus,
    example: ReminderStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @ApiPropertyOptional({
    description: 'Date and time when the reminder should be triggered',
    example: '2025-11-01T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  reminderDate?: string;

  @ApiPropertyOptional({
    description: 'Whether this reminder should repeat',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Recurring pattern (DAILY, WEEKLY, MONTHLY, YEARLY)',
    example: 'MONTHLY',
  })
  @IsOptional()
  @IsString()
  recurringPattern?: string;

  @ApiPropertyOptional({
    description: 'Types of notifications to send',
    type: [String],
    enum: NotificationType,
    example: [NotificationType.SMS, NotificationType.IN_APP],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  notificationTypes?: NotificationType[];

  @ApiPropertyOptional({
    description: 'Days before due date to send reminder',
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  advanceNoticeDays?: number;

  @ApiPropertyOptional({
    description: 'Custom amount for flexible payment reminders',
    example: 50000,
  })
  @IsOptional()
  @IsNumber()
  customAmount?: number;

  @ApiPropertyOptional({
    description: 'Additional notes for the reminder',
    example: "Don't forget to include the reference number",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
