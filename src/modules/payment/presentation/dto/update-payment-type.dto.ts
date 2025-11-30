import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentAmountType } from '@prisma/client';

export class UpdatePaymentTypeDto {
  @ApiPropertyOptional({
    description: 'Payment type name',
    example: 'Monthly Rent',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Payment type description',
    example: 'Monthly rent payment for apartment',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Base amount for this payment type',
    example: 50000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Amount type - fixed, partial allowed, or flexible',
    enum: PaymentAmountType,
    example: PaymentAmountType.FIXED,
  })
  @IsOptional()
  @IsEnum(PaymentAmountType)
  amountType?: PaymentAmountType;

  @ApiPropertyOptional({
    description: 'Allow partial payments',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowPartialPayment?: boolean;

  @ApiPropertyOptional({
    description: 'Minimum amount for partial payments',
    example: 10000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAmount?: number;

  @ApiPropertyOptional({
    description: 'Due day of the month (1-31)',
    example: 1,
    minimum: 1,
    maximum: 31,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  dueDay?: number;

  @ApiPropertyOptional({
    description: 'Is this a recurring payment',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Is this payment type active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Additional settings as JSON',
    example: {
      reminderDays: [7, 3, 1],
      lateFeeAmount: 5000,
    },
  })
  @IsOptional()
  settings?: Record<string, any>;
}
