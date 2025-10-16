import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentAmountType } from '@prisma/client';

export class PaymentTypeResponseDto {
  @ApiProperty({
    description: 'Payment type ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Payment type name',
    example: 'Monthly Rent',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Payment type description',
    example: 'Monthly rent payment for apartment',
  })
  description?: string;

  @ApiProperty({
    description: 'Base amount for this payment type',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Amount type - fixed, partial allowed, or flexible',
    enum: PaymentAmountType,
    example: PaymentAmountType.FIXED,
  })
  amountType: PaymentAmountType;

  @ApiProperty({
    description: 'Is payment type active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Allow partial payments',
    example: false,
  })
  allowPartialPayment: boolean;

  @ApiPropertyOptional({
    description: 'Minimum amount for partial payments',
    example: 10000,
  })
  minimumAmount?: number;

  @ApiPropertyOptional({
    description: 'Due day of the month (1-31)',
    example: 1,
  })
  dueDay?: number;

  @ApiProperty({
    description: 'Is this a recurring payment',
    example: true,
  })
  isRecurring: boolean;

  @ApiProperty({
    description: 'Cooperative ID',
    example: '507f1f77bcf86cd799439012',
  })
  cooperativeId: string;

  @ApiPropertyOptional({
    description: 'Additional settings',
  })
  settings?: Record<string, any>;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  constructor(paymentType: any) {
    this.id = paymentType.id;
    this.name = paymentType.name;
    this.description = paymentType.description;
    this.amount = paymentType.amount;
    this.amountType = paymentType.amountType;
    this.isActive = paymentType.isActive;
    this.allowPartialPayment = paymentType.allowPartialPayment;
    this.minimumAmount = paymentType.minimumAmount;
    this.dueDay = paymentType.dueDay;
    this.isRecurring = paymentType.isRecurring;
    this.cooperativeId = paymentType.cooperativeId;
    this.settings = paymentType.settings;
    this.createdAt = paymentType.createdAt;
    this.updatedAt = paymentType.updatedAt;
  }
}
