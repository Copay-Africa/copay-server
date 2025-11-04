import { ApiProperty } from '@nestjs/swagger';
import { NotificationType, NotificationStatus } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439020' })
  id: string;

  @ApiProperty({ enum: NotificationType, example: 'IN_APP' })
  type: NotificationType;

  @ApiProperty({ enum: NotificationStatus, example: 'SENT' })
  status: NotificationStatus;

  @ApiProperty({ example: 'Monthly Rent Due Reminder' })
  title: string;

  @ApiProperty({
    example:
      'Your Monthly Rent is due (Amount: RWF 50,000). Please make your payment on time.',
  })
  message: string;

  @ApiProperty({ example: '2025-11-02T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ 
    required: false,
    example: {
      id: '507f1f77bcf86cd799439019',
      title: 'Monthly Rent Payment',
      type: 'PAYMENT_DUE'
    }
  })
  reminder?: {
    id: string;
    title: string;
    type: string;
  };

  @ApiProperty({ 
    required: false,
    nullable: true
  })
  payment?: {
    id: string;
    amount: number;
    status: string;
  } | null;
}

export class InAppNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  data: NotificationResponseDto[];
}
