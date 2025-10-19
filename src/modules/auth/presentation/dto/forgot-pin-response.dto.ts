import { ApiProperty } from '@nestjs/swagger';

export class ForgotPinResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Reset token sent successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Timestamp when the reset token expires',
    example: '2024-10-19T12:30:00Z',
  })
  expiresAt: string;

  @ApiProperty({
    description: 'Masked phone number for confirmation',
    example: '+2507880****1',
  })
  maskedPhone: string;
}
