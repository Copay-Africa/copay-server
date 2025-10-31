import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintPriority } from '@prisma/client';

export class CreateComplaintDto {
  @ApiProperty({
    description: 'Title of the complaint',
    example: 'Water pressure issue in apartment 301',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Detailed description of the complaint',
    example: 'The water pressure in the bathroom has been very low for the past week. It affects daily activities like showering and washing dishes.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({
    description: 'Priority level of the complaint',
    enum: ComplaintPriority,
    example: ComplaintPriority.MEDIUM,
    default: ComplaintPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(ComplaintPriority)
  priority?: ComplaintPriority;

  @ApiPropertyOptional({
    description: 'Attachments metadata (file URLs, names, sizes)',
    example: [
      {
        filename: 'water_issue_photo.jpg',
        url: 'https://storage.example.com/complaints/photo1.jpg',
        size: 2048576,
        contentType: 'image/jpeg'
      }
    ],
  })
  @IsOptional()
  attachments?: any;
}