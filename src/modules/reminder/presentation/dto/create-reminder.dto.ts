import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderType, NotificationType } from '@prisma/client';

export class CreateReminderDto {
  @ApiProperty({
    description: 'Title for the reminder',
    example: 'Monthly Rent Payment',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Optional description for the reminder',
    example: 'Remember to pay rent before the due date',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Type of reminder',
    enum: ReminderType,
    example: ReminderType.PAYMENT_DUE,
  })
  @IsEnum(ReminderType)
  type: ReminderType;

  @ApiPropertyOptional({
    description: 'Payment type ID to link this reminder to',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  paymentTypeId?: string;

  @ApiProperty({
    description: 'Date and time when the reminder should be triggered',
    example: '2025-11-01T09:00:00Z',
  })
  @IsDateString()
  reminderDate: string;

  @ApiPropertyOptional({
    description: 'Whether this reminder should repeat',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean = false;

  @ApiPropertyOptional({
    description: 'Recurring pattern (DAILY, WEEKLY, MONTHLY, YEARLY)',
    example: 'MONTHLY',
  })
  @IsOptional()
  @IsString()
  recurringPattern?: string;

  @ApiProperty({
    description: 'Types of notifications to send',
    type: [String],
    enum: NotificationType,
    example: [NotificationType.SMS, NotificationType.IN_APP],
  })
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  notificationTypes: NotificationType[];

  @ApiPropertyOptional({
    description: 'Days before due date to send reminder (0 = on due date)',
    example: 3,
    minimum: 0,
    maximum: 30,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  advanceNoticeDays?: number = 0;

  @ApiPropertyOptional({
    description: 'Custom amount for flexible payment reminders',
    example: 50000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customAmount?: number;

  @ApiPropertyOptional({
    description: 'Additional notes for the reminder',
    example: "Don't forget to include the reference number",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
