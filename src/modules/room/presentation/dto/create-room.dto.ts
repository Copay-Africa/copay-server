import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsMongoId,
} from 'class-validator';
import { RoomStatus } from '@prisma/client';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room/unit number',
    example: '101',
  })
  @IsString()
  roomNumber: string;

  @ApiPropertyOptional({
    description: 'Type of room/unit',
    example: '1BR',
  })
  @IsOptional()
  @IsString()
  roomType?: string;

  @ApiPropertyOptional({
    description: 'Floor number or identifier',
    example: '1st Floor',
  })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({
    description: 'Building block or section',
    example: 'Block A',
  })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiPropertyOptional({
    description: 'Additional room description',
    example: 'Corner unit with balcony',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Room status',
    enum: RoomStatus,
    default: RoomStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({
    description: 'Monthly rent amount',
    example: 50000,
  })
  @IsOptional()
  @IsNumber()
  baseRent?: number;

  @ApiPropertyOptional({
    description: 'Security deposit required',
    example: 100000,
  })
  @IsOptional()
  @IsNumber()
  deposit?: number;

  @ApiProperty({
    description: 'Cooperative ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  cooperativeId: string;

  @ApiPropertyOptional({
    description: 'Additional room specifications (JSON object)',
    example: { squareFootage: 500, amenities: ['wifi', 'parking'] },
  })
  @IsOptional()
  specifications?: Record<string, any>;
}
