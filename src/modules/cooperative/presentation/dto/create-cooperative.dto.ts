import { IsString, IsEmail, IsOptional, IsPhoneNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCooperativeDto {
  @ApiProperty({
    description: 'Cooperative name',
    example: 'Kigali Housing Cooperative',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Unique cooperative code',
    example: 'KHC001',
  })
  @IsString()
  code: string;

  @ApiPropertyOptional({
    description: 'Cooperative description',
    example: 'A housing cooperative in Kigali for affordable housing solutions',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Cooperative address',
    example: 'Kacyiru, Kigali, Rwanda',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Cooperative phone number',
    example: '+250788123456',
  })
  @IsOptional()
  @IsPhoneNumber('RW', {
    message: 'Please provide a valid Rwandan phone number',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Cooperative email',
    example: 'admin@kigalihousing.coop',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Cooperative settings (JSON object)',
    example: {
      currency: 'RWF',
      timezone: 'Africa/Kigali',
      paymentDueDay: 1,
      reminderDays: [3, 1],
    },
  })
  @IsOptional()
  settings?: Record<string, any>;
}
