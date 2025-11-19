import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsMongoId } from 'class-validator';
import { RoomStatus } from '@prisma/client';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class RoomFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by room status',
    enum: RoomStatus,
  })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({
    description: 'Filter by room type',
    example: '1BR',
  })
  @IsOptional()
  @IsString()
  roomType?: string;

  @ApiPropertyOptional({
    description: 'Filter by floor',
    example: '1st Floor',
  })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({
    description: 'Filter by block',
    example: 'Block A',
  })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiPropertyOptional({
    description: 'Filter by cooperative ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId()
  cooperativeId?: string;
}
