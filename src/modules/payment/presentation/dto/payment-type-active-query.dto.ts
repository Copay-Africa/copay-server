import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaymentTypeActiveQueryDto {
  @ApiProperty({
    description: 'Cooperative ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  cooperativeId: string;
}