import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ForgotPinDto {
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
}
