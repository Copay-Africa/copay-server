import { IsEnum, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus } from '@prisma/client';

export class UpdateComplaintStatusDto {
  @ApiProperty({
    description: 'New status for the complaint',
    enum: ComplaintStatus,
    example: ComplaintStatus.IN_PROGRESS,
  })
  @IsEnum(ComplaintStatus)
  status: ComplaintStatus;

  @ApiPropertyOptional({
    description: 'Resolution message or notes about the status change',
    example:
      'Maintenance team has been notified and will address the water pressure issue within 24 hours.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution?: string;
}
