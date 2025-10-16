import { IsString, IsPhoneNumber, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
