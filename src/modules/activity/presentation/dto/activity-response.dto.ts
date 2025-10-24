import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';

export class ActivityResponseDto {
  @ApiProperty({
    description: 'Activity ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Activity type',
    enum: ActivityType,
    example: ActivityType.PAYMENT_INITIATED,
  })
  type: ActivityType;

  @ApiProperty({
    description: 'Human-readable activity title',
    example: 'Payment Initiated',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the activity',
    example: 'Payment of RWF 50,000 for Monthly Rent initiated',
  })
  description?: string;

  @ApiProperty({
    description: 'User ID who performed the activity',
    example: '507f1f77bcf86cd799439012',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Cooperative ID where activity occurred',
    example: '507f1f77bcf86cd799439013',
  })
  cooperativeId?: string;

  @ApiPropertyOptional({
    description: 'Additional activity metadata',
    example: {
      paymentId: '507f1f77bcf86cd799439014',
      amount: 50000,
      paymentMethod: 'MOBILE_MONEY_MTN',
    },
  })
  metadata?: any;

  @ApiPropertyOptional({
    description: 'User IP address',
    example: '192.168.1.100',
  })
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent information',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'Related payment ID',
    example: '507f1f77bcf86cd799439014',
  })
  relatedPaymentId?: string;

  @ApiPropertyOptional({
    description: 'Related complaint ID',
    example: '507f1f77bcf86cd799439015',
  })
  relatedComplaintId?: string;

  @ApiProperty({
    description: 'Whether this is a security-related event',
    example: false,
  })
  isSecurityEvent: boolean;

  @ApiPropertyOptional({
    description: 'Risk level for security events',
    example: 'LOW',
    enum: ['LOW', 'MEDIUM', 'HIGH'],
  })
  riskLevel?: string;

  @ApiProperty({
    description: 'When the activity occurred',
    example: '2025-10-24T10:30:00Z',
  })
  occurredAt: Date;

  @ApiProperty({
    description: 'When the activity was recorded',
    example: '2025-10-24T10:30:01Z',
  })
  createdAt: Date;
}
