import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus, ComplaintPriority } from '@prisma/client';

export class ComplaintResponseDto {
  @ApiProperty({
    description: 'Unique complaint identifier',
    example: '507f1f77bcf86cd799439015',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the complaint',
    example: 'Water pressure issue in apartment 301',
  })
  title: string;

  @ApiProperty({
    description: 'Detailed description of the complaint',
    example:
      'The water pressure in the bathroom has been very low for the past week.',
  })
  description: string;

  @ApiProperty({
    description: 'Current status of the complaint',
    enum: ComplaintStatus,
    example: ComplaintStatus.OPEN,
  })
  status: ComplaintStatus;

  @ApiProperty({
    description: 'Priority level of the complaint',
    enum: ComplaintPriority,
    example: ComplaintPriority.MEDIUM,
  })
  priority: ComplaintPriority;

  @ApiPropertyOptional({
    description: 'Resolution message or admin notes',
    example:
      'Maintenance team has been notified and will address the issue within 24 hours.',
  })
  resolution?: string;

  @ApiPropertyOptional({
    description: 'Date when the complaint was resolved',
    example: '2025-10-20T14:30:00Z',
  })
  resolvedAt?: Date;

  @ApiPropertyOptional({
    description: 'Complaint attachments metadata',
    example: [
      {
        filename: 'water_issue_photo.jpg',
        url: 'https://storage.example.com/complaints/photo1.jpg',
        size: 2048576,
        contentType: 'image/jpeg',
      },
    ],
  })
  attachments?: any;

  @ApiProperty({
    description: 'User who submitted the complaint',
    example: {
      id: '507f1f77bcf86cd799439013',
      firstName: 'Jean',
      lastName: 'Mukamana',
      phone: '+250788123456',
    },
  })
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };

  @ApiProperty({
    description: 'Cooperative the complaint belongs to',
    example: {
      id: '507f1f77bcf86cd799439012',
      name: 'Default Cooperative',
      code: 'DEFAULT_COOP',
    },
  })
  cooperative: {
    id: string;
    name: string;
    code: string;
  };

  @ApiProperty({
    description: 'Date when the complaint was created',
    example: '2025-10-16T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the complaint was last updated',
    example: '2025-10-16T10:30:00Z',
  })
  updatedAt: Date;
}
