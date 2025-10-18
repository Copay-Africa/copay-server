import {
  Controller,
  Post,
  Body,
  Logger,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { UssdService } from '../application/ussd.service';
import { UssdRequestDto, UssdResponseDto } from './dto/ussd.dto';
import { Public } from '../../../shared/decorators/auth.decorator';

@ApiTags('USSD')
@Controller('ussd')
@Public() // USSD endpoints are public (no JWT auth required)
export class UssdController {
  private readonly logger = new Logger(UssdController.name);

  constructor(private readonly ussdService: UssdService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle USSD requests from telecom operators',
    description: `
      Main USSD endpoint that telecoms (MTN/Airtel) will call.
      
      **Flow:**
      1. Welcome screen with menu options
      2. User authentication via PIN
      3. Payment processing or information display
      4. Session management with CON/END responses
      
      **Menu Structure:**
      - Main Menu: Make Payment | My Payments | Help
      - Payment Flow: Select Cooperative → Payment Type → Confirm → Process
      - Payment History: Display last 3 payments with status
      - Help: Show cooperative contact information
      
      **Response Format:**
      - CON: Continue session, expect more input
      - END: Terminate session, final message
    `,
  })
  @ApiHeader({
    name: 'Content-Type',
    description: 'Must be application/json',
    required: true,
  })
  @ApiBody({
    type: UssdRequestDto,
    description: 'USSD request data from telecom operator',
    examples: {
      initial_request: {
        summary: 'Initial USSD request (dial *134#)',
        value: {
          sessionId: 'session_12345678',
          phoneNumber: '+250788123456',
          text: '',
          serviceCode: '*134#',
          networkCode: 'MTN',
        },
      },
      menu_selection: {
        summary: 'User selects option 1 (Make Payment)',
        value: {
          sessionId: 'session_12345678',
          phoneNumber: '+250788123456',
          text: '1',
          serviceCode: '*134#',
          networkCode: 'MTN',
        },
      },
      pin_entry: {
        summary: 'User enters 4-digit PIN',
        value: {
          sessionId: 'session_12345678',
          phoneNumber: '+250788123456',
          text: '1234',
          serviceCode: '*134#',
          networkCode: 'MTN',
        },
      },
      payment_selection: {
        summary: 'User selects payment type',
        value: {
          sessionId: 'session_12345678',
          phoneNumber: '+250788123456',
          text: '2',
          serviceCode: '*134#',
          networkCode: 'MTN',
        },
      },
      confirmation: {
        summary: 'User confirms payment',
        value: {
          sessionId: 'session_12345678',
          phoneNumber: '+250788123456',
          text: 'Y',
          serviceCode: '*134#',
          networkCode: 'MTN',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'USSD response with message and session state',
    type: UssdResponseDto,
    examples: {
      welcome_menu: {
        summary: 'Welcome screen with main menu',
        value: {
          message: 'Welcome to Co-Pay, John!\n\n1. Make Payment\n2. My Payments\n3. Help\n\nEnter your choice:',
          sessionState: 'CON',
        },
      },
      pin_request: {
        summary: 'PIN authentication request',
        value: {
          message: 'Enter your 4-digit PIN:',
          sessionState: 'CON',
        },
      },
      payment_types: {
        summary: 'Payment type selection menu',
        value: {
          message: 'Select payment type:\n1. Monthly Rent - 50000 RWF\n2. Security Deposit - 25000 RWF\n3. Cleaning Fee - 5000 RWF\n\nEnter your choice:',
          sessionState: 'CON',
        },
      },
      payment_confirmation: {
        summary: 'Payment confirmation screen',
        value: {
          message: 'Payment Details:\nType: Monthly Rent\nAmount: 50000 RWF\nDescription: Monthly rental payment\n\nConfirm payment? (Y/N):',
          sessionState: 'CON',
        },
      },
      payment_success: {
        summary: 'Successful payment completion',
        value: {
          message: 'Payment initiated successfully!\nAmount: 50000 RWF\nReference: pay_67890123456\nYou will receive a mobile money prompt shortly.\nThank you for using Co-Pay!',
          sessionState: 'END',
        },
      },
      payment_history: {
        summary: 'Payment history display',
        value: {
          message: 'Your Recent Payments:\n\n1. Monthly Rent\n   50000 RWF - COMPLETED\n   Date: 15/10/2025\n\n2. Security Deposit\n   25000 RWF - COMPLETED\n   Date: 01/10/2025\n\n3. Cleaning Fee\n   5000 RWF - PENDING\n   Date: 14/10/2025',
          sessionState: 'END',
        },
      },
      help_info: {
        summary: 'Help and contact information',
        value: {
          message: 'Help Information:\n\nYour Cooperative: Green Valley Housing\nContact Phone: +250788555666\nContact Email: info@greenvalley.rw\n\nFor technical support:\nEmail: support@copay.rw\nPhone: +250788000000',
          sessionState: 'END',
        },
      },
      error_response: {
        summary: 'Error or service unavailable',
        value: {
          message: 'Service temporarily unavailable. Please try again later.',
          sessionState: 'END',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid USSD data format',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async handleUssdRequest(
    @Body() ussdRequest: UssdRequestDto,
  ): Promise<UssdResponseDto> {
    this.logger.log(`Incoming USSD request: ${JSON.stringify(ussdRequest)}`);

    try {
      // Validate required fields
      if (!ussdRequest.sessionId || !ussdRequest.phoneNumber) {
        throw new BadRequestException(
          'Session ID and phone number are required',
        );
      }

      // Process the USSD request
      const response = await this.ussdService.handleUssdRequest(ussdRequest);

      this.logger.log(`USSD response: ${JSON.stringify(response)}`);
      return response;
    } catch (error) {
      this.logger.error(
        `USSD request processing error: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      // Return generic error message for USSD
      return new UssdResponseDto(
        'Service temporarily unavailable. Please try again later.',
        'END',
      );
    }
  }

  /**
   * Health check endpoint for USSD service
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'USSD service health check',
    description: 'Endpoint for telecom operators to verify USSD service availability',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy and ready to handle USSD requests',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2025-10-16T10:30:00Z' },
        service: { type: 'string', example: 'Co-Pay USSD Gateway' },
      },
    },
  })
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Co-Pay USSD Gateway',
    };
  }
}