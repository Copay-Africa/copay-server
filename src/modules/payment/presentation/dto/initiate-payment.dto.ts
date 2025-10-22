import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodType } from '@prisma/client';

export class InitiatePaymentDto {
  @ApiProperty({
    description: 'Payment type ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  paymentTypeId: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 50000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethodType,
    example: PaymentMethodType.MOBILE_MONEY_MTN,
  })
  @IsEnum(PaymentMethodType)
  paymentMethod: PaymentMethodType;

  @ApiProperty({
    description: 'Phone number for mobile money or account details',
    example: '+250788123456',
  })
  @IsString()
  paymentAccount: string;

  @ApiPropertyOptional({
    description: 'Payment description',
    example: 'Monthly rent payment for October 2025',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Due date for this payment',
    example: '2025-11-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({
    description: 'Idempotency key to prevent duplicate payments',
    example: 'payment_67890abcdef12345',
  })
  @IsString()
  idempotencyKey: string;

  @ApiPropertyOptional({
    description: 'Target cooperative ID for cross-cooperative payments',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString()
  targetCooperativeId?: string;
}
