import { IsOptional, IsMongoId } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentTypeOptionalQueryDto {
  @ApiPropertyOptional({
    description: 'Cooperative ID (optional for additional validation)',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId()
  cooperativeId?: string;
}