import { ApiProperty } from '@nestjs/swagger';

export class SmsResponseDto {
  @ApiProperty({
    description: 'Whether the SMS was sent successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message from SMS provider',
    example: 'SMS sent successfully',
  })
  message: string;

  @ApiProperty({
    description: 'SMS provider reference ID',
    example: 'FDI-123456789',
    required: false,
  })
  messageId?: string;

  @ApiProperty({
    description: 'Error details if SMS failed',
    required: false,
  })
  error?: string;
}
