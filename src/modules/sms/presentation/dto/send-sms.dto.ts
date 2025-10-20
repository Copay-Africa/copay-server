import { IsString, IsNotEmpty, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendSmsDto {
  @ApiProperty({
    description: 'Recipient phone number in international format',
    example: '+250788123456',
  })
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber('RW')
  to: string;

  @ApiProperty({
    description: 'SMS message content',
    example: 'Your PIN reset code is: 123456. This code expires in 15 minutes.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
