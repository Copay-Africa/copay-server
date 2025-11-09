import { Injectable, Logger, Inject } from '@nestjs/common';
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
} from '../presentation/dto/ussd.dto';
import { PaymentMethodType, PaymentStatus } from '@prisma/client';

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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`USSD Error: ${errorMessage}`, errorStack);
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

      case 'select_payment_method':
        return this.handlePaymentMethodSelection(session, input);

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
  private async handleWelcome(
    session: UssdSessionDto,
  ): Promise<UssdResponseDto> {
    // Check if user exists
    const user = await this.prismaService.user.findUnique({
      where: { phone: session.phoneNumber },
      include: { cooperative: true },
    });

    if (!user) {
      return new UssdResponseDto(
        'Phone number not registered with Copay. Please contact your cooperative administrator.',
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
      `Welcome to Copay, ${user.firstName || 'User'}!\n\n1. Make Payment\n2. My Payments\n3. Help\n\nEnter your choice:`,
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
    const cooperatives =
      (session.sessionData.cooperatives as Array<{
        id: string;
        name: string;
      }>) || [];

    if (isNaN(choice) || choice < 1 || choice > cooperatives.length) {
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
    const paymentTypes =
      (session.sessionData.paymentTypes as Array<{
        id: string;
        name: string;
        amount: number;
      }>) || [];

    if (isNaN(choice) || choice < 1 || choice > paymentTypes.length) {
      return new UssdResponseDto(
        `Invalid choice. Please select 1-${paymentTypes.length}:`,
        'CON',
      );
    }

    const selectedPaymentType = paymentTypes[choice - 1];
    session.sessionData.selectedPaymentType = selectedPaymentType;
    session.currentStep = 'select_payment_method';

    return this.handlePaymentMethodSelection(session);
  }

  /**
   * Payment method selection handler
   */
  private async handlePaymentMethodSelection(
    session: UssdSessionDto,
    input?: string,
  ): Promise<UssdResponseDto> {
    const selectedPaymentType = session.sessionData.selectedPaymentType as {
      id: string;
      name: string;
      amount: number;
    };

    if (!input) {
      // Show payment method options
      let message = `Payment Type: ${selectedPaymentType.name}\n`;
      message += `Amount: ${selectedPaymentType.amount} RWF\n\n`;
      message += `Select payment method:\n`;
      message += `1. MTN Mobile Money\n`;
      message += `2. Airtel Money\n`;
      message += `3. Bank of Kigali\n\n`;
      message += `Enter your choice:`;

      return new UssdResponseDto(message, 'CON');
    }

    // Process payment method selection
    const choice = input.trim();
    let paymentMethod: PaymentMethodType;
    let methodName: string;

    switch (choice) {
      case '1':
        paymentMethod = PaymentMethodType.MOBILE_MONEY_MTN;
        methodName = 'MTN Mobile Money';
        break;
      case '2':
        paymentMethod = PaymentMethodType.MOBILE_MONEY_AIRTEL;
        methodName = 'Airtel Money';
        break;
      case '3':
        paymentMethod = PaymentMethodType.BANK_BK;
        methodName = 'Bank of Kigali';
        break;
      default:
        return new UssdResponseDto(
          'Invalid choice. Please select:\n1. MTN Mobile Money\n2. Airtel Money\n3. Bank of Kigali',
          'CON',
        );
    }

    session.sessionData.selectedPaymentMethod = paymentMethod;
    session.sessionData.selectedPaymentMethodName = methodName;
    session.currentStep = 'confirm_payment';

    // Save session to persist selection
    await this.saveSession(session);

    return new UssdResponseDto(
      `Payment Summary:\n` +
        `Type: ${selectedPaymentType.name}\n` +
        `Amount: ${selectedPaymentType.amount} RWF\n` +
        `Payment Method: ${methodName}\n` +
        `Phone: ${session.phoneNumber}\n\n` +
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
      const selectedPaymentType = session.sessionData.selectedPaymentType as {
        id: string;
        name: string;
        amount: number;
      };
      const selectedPaymentMethod =
        (session.sessionData.selectedPaymentMethod as PaymentMethodType) ||
        PaymentMethodType.MOBILE_MONEY_MTN;
      const paymentMethodName =
        (session.sessionData.selectedPaymentMethodName as string) ||
        'MTN Mobile Money';
      const idempotencyKey = `ussd_${session.sessionId}_${Date.now()}`;

      if (!selectedPaymentType) {
        return new UssdResponseDto(
          'Payment information not found. Please try again.',
          'END',
        );
      }

      this.logger.log(`=== USSD PAYMENT PROCESSING ===`);
      this.logger.log(`User: ${session.userId}`);
      this.logger.log(`Phone: ${session.phoneNumber}`);
      this.logger.log(`Payment Type: ${selectedPaymentType.name}`);
      this.logger.log(`Amount: ${selectedPaymentType.amount} RWF`);
      this.logger.log(`Payment Method: ${paymentMethodName}`);
      this.logger.log(`Idempotency Key: ${idempotencyKey}`);

      // Create payment request
      const paymentDto = {
        paymentTypeId: selectedPaymentType.id,
        amount: selectedPaymentType.amount,
        paymentMethod: selectedPaymentMethod,
        paymentAccount: session.phoneNumber, // Use user's phone number for mobile money
        description: `USSD Payment - ${selectedPaymentType.name} via ${paymentMethodName}`,
        idempotencyKey,
      };

      // Initiate payment via existing payment service
      const paymentResult = await this.paymentService.initiatePayment(
        paymentDto,
        session.userId!,
        session.cooperativeId,
      );

      this.logger.log(`Payment Result: ${JSON.stringify(paymentResult)}`);

      if (paymentResult.status === PaymentStatus.COMPLETED) {
        return new UssdResponseDto(
          `✅ Payment Successful!\n` +
            `Type: ${selectedPaymentType.name}\n` +
            `Amount: ${paymentResult.amount} RWF\n` +
            `Method: ${paymentMethodName}\n` +
            `Reference: ${paymentResult.paymentReference || paymentResult.id}\n\n` +
            `Thank you for using Copay!`,
          'END',
        );
      } else if (paymentResult.status === PaymentStatus.PENDING) {
        let message = `🚀 Payment Initiated!\n`;
        message += `Type: ${selectedPaymentType.name}\n`;
        message += `Amount: ${paymentResult.amount} RWF\n`;
        message += `Method: ${paymentMethodName}\n`;
        message += `Reference: ${paymentResult.paymentReference || paymentResult.id}\n\n`;

        if (
          selectedPaymentMethod === PaymentMethodType.MOBILE_MONEY_MTN ||
          selectedPaymentMethod === PaymentMethodType.MOBILE_MONEY_AIRTEL
        ) {
          message += `You will receive a mobile money prompt shortly on ${session.phoneNumber}.\n`;
          message += `Please complete the payment on your phone.\n\n`;
        } else if (selectedPaymentMethod === PaymentMethodType.BANK_BK) {
          message += `Please visit the bank to complete payment.\n`;
          message += `Payment reference: ${paymentResult.paymentReference || paymentResult.id}\n\n`;
        }

        message += `Thank you for using Copay!`;

        return new UssdResponseDto(message, 'END');
      } else {
        return new UssdResponseDto(
          `❌ Payment Failed\n` +
            `Type: ${selectedPaymentType.name}\n` +
            `Amount: ${selectedPaymentType.amount} RWF\n` +
            `Reference: ${paymentResult.id}\n\n` +
            `Please try again later or contact support.\n` +
            `Support: +250788000000`,
          'END',
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Payment processing error: ${errorMessage}`,
        errorStack,
      );
      return new UssdResponseDto(
        '❌ Payment Processing Failed\n\n' +
          'Unable to process payment at this time.\n' +
          'Please try again later or contact support.\n\n' +
          'Support: +250788000000',
        'END',
      );
    }
  }

  /**
   * View payments handler
   */
  private async handleViewPayments(
    session: UssdSessionDto,
  ): Promise<UssdResponseDto> {
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`View payments error: ${errorMessage}`, errorStack);
      return new UssdResponseDto(
        'Unable to retrieve payment history. Please try again later.',
        'END',
      );
    }
  }

  /**
   * Help menu handler
   */
  private async handleHelpMenu(
    session: UssdSessionDto,
  ): Promise<UssdResponseDto> {
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
            'Copay - Making payments simple!',
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Help menu error: ${errorMessage}`, errorStack);
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
    const sessionData = await this.cacheManager.get(
      `ussd_session_${sessionId}`,
    );
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
