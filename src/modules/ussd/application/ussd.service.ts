import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../../user/application/user.service';
import { CooperativeService } from '../../cooperative/application/cooperative.service';
import { PaymentService } from '../../payment/application/payment.service';
import {
  UssdRequestDto,
  UssdResponseDto,
  UssdSessionDto,
  UssdPaymentSummaryDto,
  UssdCooperativeSummaryDto,
  UssdPaymentTypeSummaryDto,
} from '../presentation/dto/ussd.dto';
import { PaymentMethodType, UserRole, PaymentStatus } from '@prisma/client';

@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor(
    private prismaService: PrismaService,
    private userService: UserService,
    private cooperativeService: CooperativeService,
    private paymentService: PaymentService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Main USSD request handler
   */
  async handleUssdRequest(request: UssdRequestDto): Promise<UssdResponseDto> {
    this.logger.log(`USSD Request: ${JSON.stringify(request)}`);

    try {
      // Get or create session
      let session = await this.getSession(request.sessionId);
      if (!session) {
        session = new UssdSessionDto(request.sessionId, request.phoneNumber);
      }

      // Update session activity
      session.lastActivity = new Date();
      session.inputHistory.push(request.text || '');

      // Process the request based on current step
      const response = await this.processUssdFlow(session, request.text);

      // Save session if continuing
      if (response.sessionState === 'CON') {
        await this.saveSession(session);
      } else {
        // Clear session if ending
        await this.clearSession(request.sessionId);
      }

      this.logger.log(`USSD Response: ${JSON.stringify(response)}`);
      return response;
    } catch (error) {
      this.logger.error(`USSD Error: ${error.message}`, error.stack);
      await this.clearSession(request.sessionId);
      return new UssdResponseDto(
        'Service temporarily unavailable. Please try again later.',
        'END',
      );
    }
  }

  /**
   * Process USSD flow based on current step
   */
  private async processUssdFlow(
    session: UssdSessionDto,
    input?: string,
  ): Promise<UssdResponseDto> {
    switch (session.currentStep) {
      case 'welcome':
        return this.handleWelcome(session);

      case 'main_menu':
        return this.handleMainMenu(session, input);

      case 'auth_pin':
        return this.handlePinAuthentication(session, input);

      case 'select_cooperative':
        return this.handleCooperativeSelection(session, input);

      case 'select_payment_type':
        return this.handlePaymentTypeSelection(session, input);

      case 'confirm_payment':
        return this.handlePaymentConfirmation(session, input);

      case 'process_payment':
        return this.handlePaymentProcessing(session);

      case 'view_payments':
        return this.handleViewPayments(session);

      case 'help_menu':
        return this.handleHelpMenu(session);

      default:
        return this.handleWelcome(session);
    }
  }

  /**
   * Welcome screen - first interaction
   */
  private async handleWelcome(session: UssdSessionDto): Promise<UssdResponseDto> {
    // Check if user exists
    const user = await this.prismaService.user.findUnique({
      where: { phone: session.phoneNumber },
      include: { cooperative: true },
    });

    if (!user) {
      return new UssdResponseDto(
        'Phone number not registered with Co-Pay. Please contact your cooperative administrator.',
        'END',
      );
    }

    if (user.status !== 'ACTIVE') {
      return new UssdResponseDto(
        'Your account is not active. Please contact your cooperative administrator.',
        'END',
      );
    }

    session.userId = user.id;
    session.cooperativeId = user.cooperativeId || undefined;
    session.currentStep = 'main_menu';

    return new UssdResponseDto(
      `Welcome to Co-Pay, ${user.firstName || 'User'}!\n\n1. Make Payment\n2. My Payments\n3. Help\n\nEnter your choice:`,
      'CON',
    );
  }

  /**
   * Main menu handler
   */
  private async handleMainMenu(
    session: UssdSessionDto,
    input?: string,
  ): Promise<UssdResponseDto> {
    if (!input || !['1', '2', '3'].includes(input.trim())) {
      return new UssdResponseDto(
        'Invalid choice. Please select:\n1. Make Payment\n2. My Payments\n3. Help',
        'CON',
      );
    }

    const choice = input.trim();

    switch (choice) {
      case '1':
        session.currentStep = 'auth_pin';
        return new UssdResponseDto('Enter your 4-digit PIN:', 'CON');

      case '2':
        session.currentStep = 'view_payments';
        return this.handleViewPayments(session);

      case '3':
        session.currentStep = 'help_menu';
        return this.handleHelpMenu(session);

      default:
        return new UssdResponseDto(
          'Invalid choice. Please select:\n1. Make Payment\n2. My Payments\n3. Help',
          'CON',
        );
    }
  }

  /**
   * PIN authentication handler
   */
  private async handlePinAuthentication(
    session: UssdSessionDto,
    input?: string,
  ): Promise<UssdResponseDto> {
    if (!input || input.trim().length !== 4 || !/^\d{4}$/.test(input.trim())) {
      return new UssdResponseDto(
        'Invalid PIN format. Please enter your 4-digit PIN:',
        'CON',
      );
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return new UssdResponseDto('User not found. Session terminated.', 'END');
    }

    const isValidPin = await bcrypt.compare(input.trim(), user.pin);
    if (!isValidPin) {
      return new UssdResponseDto(
        'Incorrect PIN. Please enter your 4-digit PIN:',
        'CON',
      );
    }

    // PIN is valid, check if user has cooperative or needs to select
    if (session.cooperativeId) {
      session.currentStep = 'select_payment_type';
      return this.handlePaymentTypeSelection(session);
    } else {
      session.currentStep = 'select_cooperative';
      return this.handleCooperativeSelection(session);
    }
  }

  /**
   * Cooperative selection handler (for users without default cooperative)
   */
  private async handleCooperativeSelection(
    session: UssdSessionDto,
    input?: string,
  ): Promise<UssdResponseDto> {
    if (!input) {
      // Show cooperatives list
      const cooperatives = await this.prismaService.cooperative.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        take: 9, // Limit to 9 for USSD display
      });

      if (cooperatives.length === 0) {
        return new UssdResponseDto('No active cooperatives found.', 'END');
      }

      let message = 'Select your cooperative:\n';
      cooperatives.forEach((coop, index) => {
        message += `${index + 1}. ${coop.name} (${coop.code})\n`;
      });
      message += '\nEnter your choice:';

      session.sessionData.cooperatives = cooperatives;
      return new UssdResponseDto(message, 'CON');
    }

    // Process selection
    const choice = parseInt(input.trim());
    const cooperatives = session.sessionData.cooperatives || [];

    if (
      isNaN(choice) ||
      choice < 1 ||
      choice > cooperatives.length
    ) {
      return new UssdResponseDto(
        `Invalid choice. Please select 1-${cooperatives.length}:`,
        'CON',
      );
    }

    const selectedCooperative = cooperatives[choice - 1];
    session.cooperativeId = selectedCooperative.id;
    session.currentStep = 'select_payment_type';

    return this.handlePaymentTypeSelection(session);
  }

  /**
   * Payment type selection handler
   */
  private async handlePaymentTypeSelection(
    session: UssdSessionDto,
    input?: string,
  ): Promise<UssdResponseDto> {
    if (!input) {
      // Show payment types list
      const paymentTypes = await this.prismaService.paymentType.findMany({
        where: {
          cooperativeId: session.cooperativeId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          amount: true,
          description: true,
          allowPartialPayment: true,
        },
        take: 9, // Limit to 9 for USSD display
      });

      if (paymentTypes.length === 0) {
        return new UssdResponseDto(
          'No payment types available for your cooperative.',
          'END',
        );
      }

      let message = 'Select payment type:\n';
      paymentTypes.forEach((type, index) => {
        message += `${index + 1}. ${type.name} - ${type.amount} RWF\n`;
      });
      message += '\nEnter your choice:';

      session.sessionData.paymentTypes = paymentTypes;
      return new UssdResponseDto(message, 'CON');
    }

    // Process selection
    const choice = parseInt(input.trim());
    const paymentTypes = session.sessionData.paymentTypes || [];

    if (
      isNaN(choice) ||
      choice < 1 ||
      choice > paymentTypes.length
    ) {
      return new UssdResponseDto(
        `Invalid choice. Please select 1-${paymentTypes.length}:`,
        'CON',
      );
    }

    const selectedPaymentType = paymentTypes[choice - 1];
    session.sessionData.selectedPaymentType = selectedPaymentType;
    session.currentStep = 'confirm_payment';

    return new UssdResponseDto(
      `Payment Details:\n` +
        `Type: ${selectedPaymentType.name}\n` +
        `Amount: ${selectedPaymentType.amount} RWF\n` +
        `Description: ${selectedPaymentType.description || 'N/A'}\n\n` +
        `Confirm payment? (Y/N):`,
      'CON',
    );
  }

  /**
   * Payment confirmation handler
   */
  private async handlePaymentConfirmation(
    session: UssdSessionDto,
    input?: string,
  ): Promise<UssdResponseDto> {
    if (!input || !['Y', 'N', 'y', 'n'].includes(input.trim().toUpperCase())) {
      return new UssdResponseDto(
        'Invalid input. Confirm payment? (Y/N):',
        'CON',
      );
    }

    if (input.trim().toUpperCase() === 'N') {
      return new UssdResponseDto('Payment cancelled.', 'END');
    }

    // User confirmed, process payment
    session.currentStep = 'process_payment';
    return this.handlePaymentProcessing(session);
  }

  /**
   * Payment processing handler
   */
  private async handlePaymentProcessing(
    session: UssdSessionDto,
  ): Promise<UssdResponseDto> {
    try {
    const selectedPaymentType = session.sessionData.selectedPaymentType;
    const idempotencyKey = `ussd_${session.sessionId}_${Date.now()}`;

      if (!selectedPaymentType) {
        return new UssdResponseDto(
          'Payment information not found. Please try again.',
          'END',
        );
      }

      // Create payment request
      const paymentDto = {
        paymentTypeId: selectedPaymentType.id,
        amount: selectedPaymentType.amount,
        paymentMethod: PaymentMethodType.MOBILE_MONEY_MTN, // Default to MTN for USSD
        paymentAccount: session.phoneNumber, // Use user's phone number for mobile money
        description: `USSD Payment - ${selectedPaymentType.name}`,
        idempotencyKey,
      };      // Initiate payment via existing payment service
      const paymentResult = await this.paymentService.initiatePayment(
        paymentDto,
        session.userId!,
        session.cooperativeId!,
      );

      if (paymentResult.status === PaymentStatus.COMPLETED) {
        return new UssdResponseDto(
          `Payment Successful!\n` +
            `Amount: ${paymentResult.amount} RWF\n` +
            `Reference: ${paymentResult.id}\n` +
            `Thank you for using Co-Pay!`,
          'END',
        );
      } else if (paymentResult.status === PaymentStatus.PENDING) {
        return new UssdResponseDto(
          `Payment initiated successfully!\n` +
            `Amount: ${paymentResult.amount} RWF\n` +
            `Reference: ${paymentResult.id}\n` +
            `You will receive a mobile money prompt shortly.\n` +
            `Thank you for using Co-Pay!`,
          'END',
        );
      } else {
        return new UssdResponseDto(
          `Payment failed. Please try again later or contact support.\n` +
            `Reference: ${paymentResult.id}`,
          'END',
        );
      }
    } catch (error) {
      this.logger.error(`Payment processing error: ${error.message}`, error.stack);
      return new UssdResponseDto(
        'Payment processing failed. Please try again later.',
        'END',
      );
    }
  }

  /**
   * View payments handler
   */
  private async handleViewPayments(session: UssdSessionDto): Promise<UssdResponseDto> {
    try {
      const payments = await this.prismaService.payment.findMany({
        where: {
          senderId: session.userId,
          cooperativeId: session.cooperativeId,
        },
        include: {
          paymentType: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 3, // Last 3 payments
      });

      if (payments.length === 0) {
        return new UssdResponseDto('No payment history found.', 'END');
      }

      let message = 'Your Recent Payments:\n\n';
      payments.forEach((payment, index) => {
        const date = payment.createdAt.toLocaleDateString('en-GB');
        message += `${index + 1}. ${payment.paymentType.name}\n`;
        message += `   ${payment.amount} RWF - ${payment.status}\n`;
        message += `   Date: ${date}\n\n`;
      });

      return new UssdResponseDto(message, 'END');
    } catch (error) {
      this.logger.error(`View payments error: ${error.message}`, error.stack);
      return new UssdResponseDto(
        'Unable to retrieve payment history. Please try again later.',
        'END',
      );
    }
  }

  /**
   * Help menu handler
   */
  private async handleHelpMenu(session: UssdSessionDto): Promise<UssdResponseDto> {
    try {
      const cooperative = await this.prismaService.cooperative.findUnique({
        where: { id: session.cooperativeId },
        select: { name: true, phone: true, email: true },
      });

      if (!cooperative) {
        return new UssdResponseDto(
          'Help Information:\n\n' +
            'For technical support, please contact:\n' +
            'Email: support@copay.rw\n' +
            'Phone: +250788000000\n\n' +
            'Co-Pay - Making payments simple!',
          'END',
        );
      }

      return new UssdResponseDto(
        `Help Information:\n\n` +
          `Your Cooperative: ${cooperative.name}\n` +
          `Contact Phone: ${cooperative.phone || 'Not available'}\n` +
          `Contact Email: ${cooperative.email || 'Not available'}\n\n` +
          `For technical support:\n` +
          `Email: support@copay.rw\n` +
          `Phone: +250788000000`,
        'END',
      );
    } catch (error) {
      this.logger.error(`Help menu error: ${error.message}`, error.stack);
      return new UssdResponseDto(
        'Help information temporarily unavailable. Please contact your cooperative directly.',
        'END',
      );
    }
  }

  /**
   * Session management methods
   */
  private async getSession(sessionId: string): Promise<UssdSessionDto | null> {
    const sessionData = await this.cacheManager.get(`ussd_session_${sessionId}`);
    return sessionData as UssdSessionDto | null;
  }

  private async saveSession(session: UssdSessionDto): Promise<void> {
    await this.cacheManager.set(
      `ussd_session_${session.sessionId}`,
      session,
      this.SESSION_TIMEOUT,
    );
  }

  private async clearSession(sessionId: string): Promise<void> {
    await this.cacheManager.del(`ussd_session_${sessionId}`);
  }
}