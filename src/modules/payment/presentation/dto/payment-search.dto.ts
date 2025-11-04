import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsNumber,
  Min,
  IsMongoId,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, PaymentMethodType } from '@prisma/client';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';
import { Transform } from 'class-transformer';

export class PaymentSearchDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    enum: PaymentMethodType,
    example: PaymentMethodType.MOBILE_MONEY_MTN,
  })
  @IsOptional()
  @IsEnum(PaymentMethodType)
  paymentMethod?: PaymentMethodType;

  @ApiPropertyOptional({
    description: 'Filter by cooperative ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString()
  @IsMongoId()
  cooperativeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment type ID',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsString()
  @IsMongoId()
  paymentTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by sender user ID',
    example: '507f1f77bcf86cd799439014',
  })
  @IsOptional()
  @IsString()
  @IsMongoId()
  senderId?: string;

  @ApiPropertyOptional({
    description: 'Minimum payment amount',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value ? parseFloat(String(value)) : undefined))
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum payment amount',
    example: 100000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value ? parseFloat(String(value)) : undefined))
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Filter payments created from this date',
    example: '2025-10-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter payments created until this date',
    example: '2025-10-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter payments paid from this date',
    example: '2025-10-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  paidFromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter payments paid until this date',
    example: '2025-10-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  paidToDate?: string;
}
