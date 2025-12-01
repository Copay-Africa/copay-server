import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class ApproveTenantDto {
  @ApiProperty({
    enum: UserStatus,
    description: 'User status (ACTIVE for approval, INACTIVE for rejection)',
    example: 'ACTIVE',
  })
  @IsEnum(UserStatus, { message: 'Status must be a valid UserStatus value' })
  status: UserStatus;

  @ApiProperty({
    description: 'Rejection reason (required when status is not ACTIVE)',
    example: 'Incomplete documentation provided',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Rejection reason cannot exceed 500 characters' })
  rejectionReason?: string;
}