import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class TenantDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  phone: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiPropertyOptional()
  cooperativeId?: string;

  @ApiPropertyOptional()
  cooperative?: {
    id: string;
    name: string;
    code: string;
    status: string;
  };

  @ApiPropertyOptional()
  lastLoginAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  totalPayments?: number;

  @ApiPropertyOptional()
  totalPaymentAmount?: number;

  @ApiPropertyOptional()
  lastPaymentAt?: Date;

  @ApiPropertyOptional()
  activeComplaints?: number;
}
