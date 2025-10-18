import { IsString, IsNotEmpty, IsOptional, IsPhoneNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * USSD Request DTO
 * Standard format for telecom USSD requests
 */
export class UssdRequestDto {
  @ApiProperty({
    description: 'Session ID provided by telecom operator',
    example: 'session_12345',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    description: 'Phone number of the user (international format)',
    example: '+250788123456',
  })
  @IsPhoneNumber('RW') // Rwanda phone number validation
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'USSD text input from user',
    example: '1*2*1',
  })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({
    description: 'Service code dialed (e.g., *134#)',
    example: '*134#',
  })
  @IsString()
  @IsOptional()
  serviceCode?: string;

  @ApiPropertyOptional({
    description: 'Network code from telecom operator',
    example: 'MTN',
  })
  @IsString()
  @IsOptional()
  networkCode?: string;
}

/**
 * USSD Response DTO
 * Standard format for USSD responses to telecom operators
 */
export class UssdResponseDto {
  @ApiProperty({
    description: 'Response message to display to user',
    example: 'Welcome to Co-Pay\n1. Make Payment\n2. My Payments\n3. Help',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Session state - CON to continue, END to terminate',
    example: 'CON',
    enum: ['CON', 'END'],
  })
  @IsString()
  @IsNotEmpty()
  sessionState: 'CON' | 'END';

  constructor(message: string, sessionState: 'CON' | 'END' = 'CON') {
    this.message = message;
    this.sessionState = sessionState;
  }
}

/**
 * USSD Session Data DTO
 * Internal session management
 */
export class UssdSessionDto {
  @ApiProperty({ description: 'Unique session identifier' })
  sessionId: string;

  @ApiProperty({ description: 'User phone number' })
  phoneNumber: string;

  @ApiProperty({ description: 'Current menu step' })
  currentStep: string;

  @ApiProperty({ description: 'User input history', type: [String] })
  inputHistory: string[];

  @ApiProperty({ description: 'Session data', type: Object })
  sessionData: Record<string, any>;

  @ApiProperty({ description: 'User ID if authenticated' })
  userId?: string;

  @ApiProperty({ description: 'Cooperative ID if selected' })
  cooperativeId?: string;

  @ApiProperty({ description: 'Session start time' })
  startTime: Date;

  @ApiProperty({ description: 'Last activity time' })
  lastActivity: Date;

  constructor(sessionId: string, phoneNumber: string) {
    this.sessionId = sessionId;
    this.phoneNumber = phoneNumber;
    this.currentStep = 'welcome';
    this.inputHistory = [];
    this.sessionData = {};
    this.startTime = new Date();
    this.lastActivity = new Date();
  }
}

/**
 * Payment Summary DTO for USSD display
 */
export class UssdPaymentSummaryDto {
  @ApiProperty({ description: 'Payment type name' })
  type: string;

  @ApiProperty({ description: 'Payment amount' })
  amount: number;

  @ApiProperty({ description: 'Payment date' })
  date: string;

  @ApiProperty({ description: 'Payment status' })
  status: string;

  @ApiProperty({ description: 'Payment reference' })
  reference?: string;
}

/**
 * Cooperative Summary DTO for USSD display
 */
export class UssdCooperativeSummaryDto {
  @ApiProperty({ description: 'Cooperative ID' })
  id: string;

  @ApiProperty({ description: 'Cooperative name' })
  name: string;

  @ApiProperty({ description: 'Cooperative code' })
  code: string;

  @ApiProperty({ description: 'Contact phone' })
  phone?: string;

  @ApiProperty({ description: 'Contact email' })
  email?: string;
}

/**
 * Payment Type Summary DTO for USSD display
 */
export class UssdPaymentTypeSummaryDto {
  @ApiProperty({ description: 'Payment type ID' })
  id: string;

  @ApiProperty({ description: 'Payment type name' })
  name: string;

  @ApiProperty({ description: 'Payment amount' })
  amount: number;

  @ApiProperty({ description: 'Payment description' })
  description?: string;

  @ApiProperty({ description: 'Whether partial payment is allowed' })
  allowPartialPayment: boolean;
}