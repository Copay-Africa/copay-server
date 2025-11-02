import {
  IsString,
  IsPhoneNumber,
  Length,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Phone number with country code',
    example: '+250788123456',
  })
  @IsString()
  @IsPhoneNumber('RW', {
    message: 'Please provide a valid Rwandan phone number',
  })
  phone: string;

  @ApiProperty({
    description: '4-digit PIN',
    example: '1234',
  })
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'PIN must contain only digits' })
  pin: string;

  @ApiPropertyOptional({
    description: 'Firebase Cloud Messaging token for push notifications',
    example: 'eK4VUu1234567890:APA91bFwOoE1234567890abcdefgh...',
  })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}
