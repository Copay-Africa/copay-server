import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CooperativeStatus } from '@prisma/client';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class CooperativeSearchDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by cooperative status',
    enum: CooperativeStatus,
    example: CooperativeStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(CooperativeStatus)
  status?: CooperativeStatus;

  @ApiPropertyOptional({
    description: 'Filter cooperatives created from this date',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter cooperatives created until this date',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
