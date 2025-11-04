import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
  MinLength,
  MaxLength,
  IsMongoId,
} from 'class-validator';
import {
  AnnouncementTargetType,
  AnnouncementPriority,
  NotificationType,
} from '@prisma/client';

export class CreateAnnouncementDto {
  @ApiProperty({
    description: 'Announcement title',
    example: 'Important Maintenance Notice',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'Announcement message content',
    example:
      'Dear residents, we will be conducting maintenance on the water system this weekend...',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({
    description: 'Announcement priority level',
    enum: AnnouncementPriority,
    default: AnnouncementPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority = AnnouncementPriority.NORMAL;

  @ApiProperty({
    description: 'Target audience type',
    enum: AnnouncementTargetType,
    example: AnnouncementTargetType.ALL_TENANTS,
  })
  @IsEnum(AnnouncementTargetType)
  targetType: AnnouncementTargetType;

  @ApiPropertyOptional({
    description:
      'Specific cooperative IDs to target (required for SPECIFIC_COOPERATIVE)',
    type: [String],
    example: ['507f1f77bcf86cd799439012'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  targetCooperativeIds?: string[];

  @ApiPropertyOptional({
    description: 'Specific user IDs to target (required for SPECIFIC_USERS)',
    type: [String],
    example: ['507f1f77bcf86cd799439013'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  targetUserIds?: string[];

  @ApiProperty({
    description: 'Notification channels to use for delivery',
    enum: NotificationType,
    isArray: true,
    example: [
      NotificationType.IN_APP,
      NotificationType.PUSH_NOTIFICATION,
      NotificationType.SMS,
    ],
  })
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  notificationTypes: NotificationType[];

  @ApiPropertyOptional({
    description:
      'Schedule the announcement for later (ISO 8601 format). Leave empty for immediate sending.',
    example: '2025-11-05T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({
    description: 'Update announcement title',
    minLength: 3,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Update announcement message',
    minLength: 10,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Update priority level',
    enum: AnnouncementPriority,
  })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @ApiPropertyOptional({
    description: 'Update scheduled time',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
