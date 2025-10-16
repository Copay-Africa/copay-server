import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class PaymentWebhookDto {
  @ApiProperty({
    description: 'Gateway transaction ID',
    example: 'irp_tx_67890abcdef12345',
  })
  @IsString()
  gatewayTransactionId: string;

  @ApiProperty({
    description: 'Payment status from gateway',
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED,
  })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Gateway reference',
    example: 'REF123456789',
  })
  @IsOptional()
  @IsString()
  gatewayReference?: string;

  @ApiPropertyOptional({
    description: 'Failure reason if payment failed',
    example: 'Insufficient funds',
  })
  @IsOptional()
  @IsString()
  failureReason?: string;

  @ApiProperty({
    description: 'Raw gateway response data',
    example: {
      transaction_id: 'irp_tx_67890abcdef12345',
      amount: 50000,
      currency: 'RWF',
      status: 'completed',
      payment_method: 'mtn_momo',
    },
  })
  @IsObject()
  gatewayData: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Webhook signature for verification',
    example: 'sha256=1234567890abcdef...',
  })
  @IsOptional()
  @IsString()
  signature?: string;
}
