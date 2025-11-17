import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CooperativeCategoryResponseDto {
  @ApiProperty({
    description: 'Category ID',
    example: '64a1b2c3d4e5f6789abcdef0',
  })
  id: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Residential Apartment',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Residential apartment complexes and housing cooperatives',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Icon name or emoji for UI representation',
    example: '🏠',
  })
  icon?: string;

  @ApiPropertyOptional({
    description: 'Hex color code for UI theming',
    example: '#3B82F6',
  })
  color?: string;

  @ApiProperty({
    description: 'Whether the category is active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Sort order for UI display',
    example: 1,
  })
  sortOrder?: number;

  @ApiProperty({
    description: 'Number of cooperatives in this category',
    example: 15,
  })
  cooperativeCount: number;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-11-17T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-11-17T10:30:00.000Z',
  })
  updatedAt: Date;
}
