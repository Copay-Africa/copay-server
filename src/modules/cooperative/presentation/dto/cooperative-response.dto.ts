import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CooperativeStatus } from '@prisma/client';

export class CooperativeResponseDto {
  @ApiProperty({
    description: 'Cooperative ID',
  })
  id: string;

  @ApiProperty({
    description: 'Cooperative name',
    example: 'Kigali Housing Cooperative',
  })
  name: string;

  @ApiProperty({
    description: 'Unique cooperative code',
    example: 'KHC001',
  })
  code: string;

  @ApiPropertyOptional({
    description: 'Category ID',
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Category information',
    example: {
      id: '507f1f77bcf86cd799439011',
      name: 'Housing',
      description: 'Housing cooperatives',
    },
  })
  category?: {
    id: string;
    name: string;
    description?: string;
  };

  @ApiPropertyOptional({
    description: 'Cooperative description',
    example: 'A housing cooperative in Kigali for affordable housing solutions',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Cooperative address',
    example: 'Kacyiru, Kigali, Rwanda',
  })
  address?: string;

  @ApiPropertyOptional({
    description: 'Cooperative phone number',
    example: '+250788123456',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Cooperative email',
    example: 'admin@kigalihousing.coop',
  })
  email?: string;

  @ApiProperty({
    description: 'Cooperative status',
    enum: CooperativeStatus,
  })
  status: CooperativeStatus;

  @ApiPropertyOptional({
    description: 'Cooperative settings',
  })
  settings?: Record<string, any>;

  @ApiProperty({
    description: 'Number of members',
  })
  memberCount?: number;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
