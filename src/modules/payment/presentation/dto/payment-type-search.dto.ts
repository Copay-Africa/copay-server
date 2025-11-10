import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentAmountType } from '@prisma/client';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';
import { Transform } from 'class-transformer';

export class PaymentTypeSearchDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by cooperative ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString()
  @IsMongoId()
  cooperativeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by recurring payment types',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by payment amount type',
    enum: PaymentAmountType,
    example: PaymentAmountType.FIXED,
  })
  @IsOptional()
  @IsEnum(PaymentAmountType)
  amountType?: PaymentAmountType;

  @ApiPropertyOptional({
    description: 'Filter payment types created from this date',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter payment types created until this date',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
