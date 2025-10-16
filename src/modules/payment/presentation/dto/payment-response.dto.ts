import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, PaymentMethodType } from '@prisma/client';

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Payment description',
    example: 'Monthly rent payment for October 2025',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Due date for this payment',
  })
  dueDate?: Date;

  @ApiProperty({
    description: 'Payment type information',
  })
  paymentType: {
    id: string;
    name: string;
    description?: string;
  };

  @ApiPropertyOptional({
    description: 'Payment method used',
    enum: PaymentMethodType,
  })
  paymentMethod?: PaymentMethodType;

  @ApiPropertyOptional({
    description: 'External payment reference',
  })
  paymentReference?: string;

  @ApiProperty({
    description: 'Sender information',
  })
  sender: {
    id: string;
    firstName?: string;
    lastName?: string;
    phone: string;
  };

  @ApiProperty({
    description: 'Cooperative information',
  })
  cooperative: {
    id: string;
    name: string;
    code: string;
  };

  @ApiPropertyOptional({
    description: 'When payment was completed',
  })
  paidAt?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
