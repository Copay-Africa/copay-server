import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export enum CooperativeCategorySortBy {
  NAME = 'name',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  SORT_ORDER = 'sortOrder',
  COOPERATIVE_COUNT = 'cooperativeCount',
}

export class CooperativeCategoryFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: CooperativeCategorySortBy,
    example: CooperativeCategorySortBy.NAME,
    default: CooperativeCategorySortBy.SORT_ORDER,
  })
  @IsOptional()
  @IsEnum(CooperativeCategorySortBy)
  sortBy?: CooperativeCategorySortBy = CooperativeCategorySortBy.SORT_ORDER;
}
