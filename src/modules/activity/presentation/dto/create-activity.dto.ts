import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';

export class CreateActivityDto {
  @ApiProperty({
    description: 'Activity type',
    enum: ActivityType,
    example: ActivityType.PAYMENT_INITIATED,
  })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({
    description: 'Human-readable activity title',
    example: 'Payment Initiated',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the activity',
    example: 'Payment of RWF 50,000 for Monthly Rent initiated',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional activity metadata',
    example: {
      paymentId: '507f1f77bcf86cd799439014',
      amount: 50000,
      paymentMethod: 'MOBILE_MONEY_MTN',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;

  @ApiPropertyOptional({
    description: 'Related payment ID',
    example: '507f1f77bcf86cd799439014',
  })
  @IsOptional()
  @IsString()
  relatedPaymentId?: string;

  @ApiPropertyOptional({
    description: 'Related complaint ID',
    example: '507f1f77bcf86cd799439015',
  })
  @IsOptional()
  @IsString()
  relatedComplaintId?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a security-related event',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isSecurityEvent?: boolean = false;

  @ApiPropertyOptional({
    description: 'Risk level for security events',
    example: 'LOW',
    enum: ['LOW', 'MEDIUM', 'HIGH'],
  })
  @IsOptional()
  @IsString()
  riskLevel?: string;

  @ApiPropertyOptional({
    description: 'When the activity occurred (defaults to current time)',
    example: '2025-10-24T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
