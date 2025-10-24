import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderType, ReminderStatus, NotificationType } from '@prisma/client';

export class ReminderResponseDto {
  @ApiProperty({
    description: 'Reminder ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Title for the reminder',
    example: 'Monthly Rent Payment',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Optional description for the reminder',
    example: 'Remember to pay rent before the due date',
  })
  description?: string;

  @ApiProperty({
    description: 'Type of reminder',
    enum: ReminderType,
    example: ReminderType.PAYMENT_DUE,
  })
  type: ReminderType;

  @ApiProperty({
    description: 'Current status of the reminder',
    enum: ReminderStatus,
    example: ReminderStatus.ACTIVE,
  })
  status: ReminderStatus;

  @ApiProperty({
    description: 'User ID who created the reminder',
    example: '507f1f77bcf86cd799439012',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Cooperative ID',
    example: '507f1f77bcf86cd799439013',
  })
  cooperativeId?: string;

  @ApiPropertyOptional({
    description: 'Payment type ID',
    example: '507f1f77bcf86cd799439014',
  })
  paymentTypeId?: string;

  @ApiPropertyOptional({
    description: 'Payment type details',
    example: {
      id: '507f1f77bcf86cd799439014',
      name: 'Monthly Rent',
      amount: 50000,
    },
  })
  paymentType?: {
    id: string;
    name: string;
    amount: number;
    description?: string;
  };

  @ApiProperty({
    description: 'Date and time when the reminder should be triggered',
    example: '2025-11-01T09:00:00Z',
  })
  reminderDate: Date;

  @ApiProperty({
    description: 'Whether this reminder repeats',
    example: true,
  })
  isRecurring: boolean;

  @ApiPropertyOptional({
    description: 'Recurring pattern',
    example: 'MONTHLY',
  })
  recurringPattern?: string;

  @ApiProperty({
    description: 'Types of notifications to send',
    type: [String],
    enum: NotificationType,
    example: [NotificationType.SMS, NotificationType.IN_APP],
  })
  notificationTypes: string[];

  @ApiProperty({
    description: 'Days before due date to send reminder',
    example: 3,
  })
  advanceNoticeDays: number;

  @ApiPropertyOptional({
    description: 'Custom amount for flexible payment reminders',
    example: 50000,
  })
  customAmount?: number;

  @ApiPropertyOptional({
    description: 'Additional notes for the reminder',
    example: "Don't forget to include the reference number",
  })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Last time this reminder was triggered',
    example: '2025-10-01T09:00:00Z',
  })
  lastTriggered?: Date;

  @ApiPropertyOptional({
    description: 'Next time this reminder will be triggered',
    example: '2025-11-01T09:00:00Z',
  })
  nextTrigger?: Date;

  @ApiProperty({
    description: 'Number of times this reminder has been triggered',
    example: 5,
  })
  triggerCount: number;

  @ApiProperty({
    description: 'When the reminder was created',
    example: '2025-10-24T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the reminder was last updated',
    example: '2025-10-24T10:30:00Z',
  })
  updatedAt: Date;
}
