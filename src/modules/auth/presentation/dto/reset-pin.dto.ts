import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class ResetPinDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+250788000001',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+2507[8|9][0-9]{7}$/, {
    message: 'Phone number must be a valid Rwandan number (+2507XXXXXXXX)',
  })
  phone: string;

  @ApiProperty({
    description: 'Reset token received via SMS',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Reset token must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Reset token must contain only digits' })
  resetToken: string;

  @ApiProperty({
    description: 'New 4-digit PIN',
    example: '1234',
  })
  @IsNotEmpty()
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'PIN must contain only digits' })
  newPin: string;
}
