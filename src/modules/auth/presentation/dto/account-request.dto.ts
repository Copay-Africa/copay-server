import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsPhoneNumber,
  Length,
  IsMongoId,
} from 'class-validator';

export class CreateAccountRequestDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe Mukiza',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  fullName: string;

  @ApiProperty({
    description: 'Phone number in international format',
    example: '+250788000003',
  })
  @IsPhoneNumber('RW')
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Cooperative ID',
    example: '64f8a123b4567890abcdef12',
  })
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  cooperativeId: string;

  @ApiProperty({
    description: 'Room or unit number',
    example: 'Room 205',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  roomNumber: string;
}

export class AccountRequestResponseDto {
  @ApiProperty({
    description: 'Account request ID',
    example: '64f8a123b4567890abcdef12',
  })
  id: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe Mukiza',
  })
  fullName: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+250788000003',
  })
  phone: string;

  @ApiProperty({
    description: 'Cooperative information',
    example: {
      id: '64f8a123b4567890abcdef12',
      name: 'Kigali Heights Cooperative',
      code: 'KHC001',
    },
  })
  cooperative: {
    id: string;
    name: string;
    code: string;
  };

  @ApiProperty({
    description: 'Room number',
    example: 'Room 205',
  })
  roomNumber: string;

  @ApiProperty({
    description: 'Request status',
    example: 'PENDING',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
  })
  status: string;

  @ApiProperty({
    description: 'Rejection reason if applicable',
    example: 'Room number already occupied',
    required: false,
  })
  rejectionReason?: string;

  @ApiProperty({
    description: 'Admin notes',
    example: 'Verified with property manager',
    required: false,
  })
  notes?: string;

  @ApiProperty({
    description: 'Request creation date',
    example: '2024-10-19T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last updated date',
    example: '2024-10-19T11:45:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Processing information',
    required: false,
  })
  processedAt?: Date;

  @ApiProperty({
    description: 'Admin who processed the request',
    required: false,
  })
  processedBy?: {
    id: string;
    fullName: string;
  };
}

export class ProcessAccountRequestDto {
  @ApiProperty({
    description: 'Action to take',
    example: 'APPROVE',
    enum: ['APPROVE', 'REJECT'],
  })
  @IsString()
  @IsNotEmpty()
  action: 'APPROVE' | 'REJECT';

  @ApiProperty({
    description: 'Admin notes',
    example: 'Verified with property manager',
    required: false,
  })
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Rejection reason (required if rejecting)',
    example: 'Room number already occupied',
    required: false,
  })
  @IsString()
  rejectionReason?: string;
}

export class AccountRequestStatsDto {
  @ApiProperty({
    description: 'Total number of requests',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Number of pending requests',
    example: 10,
  })
  pending: number;

  @ApiProperty({
    description: 'Number of approved requests',
    example: 12,
  })
  approved: number;

  @ApiProperty({
    description: 'Number of rejected requests',
    example: 3,
  })
  rejected: number;
}
