import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class TenantFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by user status',
    enum: UserStatus,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Filter by cooperative ID',
  })
  @IsOptional()
  @IsString()
  cooperativeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by role - defaults to TENANT only',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Date range start (ISO string)',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Date range end (ISO string)',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
