import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateRoomDto } from './create-room.dto';
import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { RoomStatus } from '@prisma/client';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {
  @ApiPropertyOptional({
    description: 'Room/unit number',
    example: '101A',
  })
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @ApiPropertyOptional({
    description: 'Type of room/unit',
    example: '2BR',
  })
  @IsOptional()
  @IsString()
  roomType?: string;

  @ApiPropertyOptional({
    description: 'Floor number or identifier',
    example: '2nd Floor',
  })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({
    description: 'Building block or section',
    example: 'Block B',
  })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiPropertyOptional({
    description: 'Additional room description',
    example: 'Renovated unit with modern appliances',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Room status',
    enum: RoomStatus,
  })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({
    description: 'Monthly rent amount',
    example: 55000,
  })
  @IsOptional()
  @IsNumber()
  baseRent?: number;

  @ApiPropertyOptional({
    description: 'Security deposit required',
    example: 110000,
  })
  @IsOptional()
  @IsNumber()
  deposit?: number;

  @ApiPropertyOptional({
    description: 'Additional room specifications (JSON object)',
    example: { squareFootage: 600, amenities: ['wifi', 'parking', 'gym'] },
  })
  @IsOptional()
  specifications?: Record<string, any>;
}
