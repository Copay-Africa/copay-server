import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AnnouncementStatus,
  AnnouncementTargetType,
  AnnouncementPriority,
  NotificationType,
} from '@prisma/client';

export class AnnouncementResponseDto {
  @ApiProperty({
    description: 'Announcement ID',
    example: '507f1f77bcf86cd799439020',
  })
  id: string;

  @ApiProperty({
    description: 'Announcement title',
    example: 'Important Maintenance Notice',
  })
  title: string;

  @ApiProperty({
    description: 'Announcement message',
    example:
      'Dear residents, we will be conducting maintenance on the water system this weekend...',
  })
  message: string;

  @ApiProperty({
    description: 'Priority level',
    enum: AnnouncementPriority,
    example: AnnouncementPriority.NORMAL,
  })
  priority: AnnouncementPriority;

  @ApiProperty({
    description: 'Current status',
    enum: AnnouncementStatus,
    example: AnnouncementStatus.SENT,
  })
  status: AnnouncementStatus;

  @ApiProperty({
    description: 'Target audience type',
    enum: AnnouncementTargetType,
    example: AnnouncementTargetType.ALL_TENANTS,
  })
  targetType: AnnouncementTargetType;

  @ApiPropertyOptional({
    description: 'Targeted cooperative IDs',
    type: [String],
    example: ['507f1f77bcf86cd799439012'],
  })
  targetCooperativeIds?: string[];

  @ApiPropertyOptional({
    description: 'Targeted user IDs',
    type: [String],
    example: ['507f1f77bcf86cd799439013'],
  })
  targetUserIds?: string[];

  @ApiProperty({
    description: 'Notification channels used',
    enum: NotificationType,
    isArray: true,
    example: [NotificationType.IN_APP, NotificationType.PUSH_NOTIFICATION],
  })
  notificationTypes: NotificationType[];

  @ApiPropertyOptional({
    description: 'Scheduled delivery time',
    example: '2025-11-05T09:00:00Z',
  })
  scheduledAt?: Date;

  @ApiPropertyOptional({
    description: 'Actual sent time',
    example: '2025-11-05T09:00:15Z',
  })
  sentAt?: Date;

  @ApiProperty({
    description: 'Creator information',
    type: 'object',
    additionalProperties: false,
    example: {
      id: '507f1f77bcf86cd799439013',
      firstName: 'John',
      lastName: 'Admin',
      role: 'ORGANIZATION_ADMIN',
    },
  })
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };

  @ApiPropertyOptional({
    description: 'Associated cooperative (for organization admins)',
    type: 'object',
    additionalProperties: false,
    example: {
      id: '507f1f77bcf86cd799439012',
      name: 'Green Valley Housing',
      code: 'GVH001',
    },
  })
  cooperative?: {
    id: string;
    name: string;
    code: string;
  };

  @ApiProperty({
    description: 'Delivery statistics',
    type: 'object',
    additionalProperties: false,
    example: {
      total: 150,
      sent: 150,
      delivered: 142,
      failed: 8,
    },
  })
  statistics: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
  };

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-11-04T14:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-11-04T14:35:00Z',
  })
  updatedAt: Date;
}

export class AnnouncementSummaryDto {
  @ApiProperty({
    description: 'Announcement ID',
    example: '507f1f77bcf86cd799439020',
  })
  id: string;

  @ApiProperty({
    description: 'Announcement title',
    example: 'Important Maintenance Notice',
  })
  title: string;

  @ApiProperty({
    description: 'Current status',
    enum: AnnouncementStatus,
    example: AnnouncementStatus.SENT,
  })
  status: AnnouncementStatus;

  @ApiProperty({
    description: 'Priority level',
    enum: AnnouncementPriority,
    example: AnnouncementPriority.NORMAL,
  })
  priority: AnnouncementPriority;

  @ApiProperty({
    description: 'Target audience type',
    enum: AnnouncementTargetType,
    example: AnnouncementTargetType.ALL_TENANTS,
  })
  targetType: AnnouncementTargetType;

  @ApiProperty({
    description: 'Total recipients',
    example: 150,
  })
  totalRecipients: number;

  @ApiProperty({
    description: 'Successfully sent count',
    example: 142,
  })
  sentCount: number;

  @ApiPropertyOptional({
    description: 'Scheduled delivery time',
    example: '2025-11-05T09:00:00Z',
  })
  scheduledAt?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-11-04T14:30:00Z',
  })
  createdAt: Date;
}

export class AnnouncementStatsDto {
  @ApiProperty({
    description: 'Total announcements created',
    example: 45,
  })
  total: number;

  @ApiProperty({
    description: 'Breakdown by status',
    type: 'array',
    example: [
      { status: 'SENT', count: 30 },
      { status: 'DRAFT', count: 8 },
      { status: 'SCHEDULED', count: 5 },
      { status: 'SENDING', count: 2 },
    ],
  })
  statusBreakdown: Array<{
    status: AnnouncementStatus;
    count: number;
  }>;

  @ApiProperty({
    description: 'Breakdown by target type',
    type: 'array',
    example: [
      { targetType: 'ALL_TENANTS', count: 25 },
      { targetType: 'SPECIFIC_COOPERATIVE', count: 15 },
      { targetType: 'ALL_ORGANIZATION_ADMINS', count: 5 },
    ],
  })
  targetTypeBreakdown: Array<{
    targetType: AnnouncementTargetType;
    count: number;
  }>;

  @ApiProperty({
    description: 'Recent announcements',
    type: [AnnouncementSummaryDto],
  })
  recentAnnouncements: AnnouncementSummaryDto[];
}
