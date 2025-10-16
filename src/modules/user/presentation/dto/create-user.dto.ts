import {
  IsString,
  IsPhoneNumber,
  IsEmail,
  IsOptional,
  Length,
  Matches,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
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
    description: 'First name',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    default: UserRole.TENANT,
  })
  @IsEnum(UserRole)
  role: UserRole = UserRole.TENANT;

  @ApiPropertyOptional({
    description: 'Cooperative ID (for tenants and organization admins)',
  })
  @IsOptional()
  @IsString()
  cooperativeId?: string;
}
