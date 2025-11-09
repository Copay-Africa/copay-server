import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  PaymentGatewayRequest,
  PaymentGatewayResponse,
  PaymentGatewayStatus,
} from './payment-gateway.interface';

interface IremboPayInvoiceResponse {
  success: boolean;
  data: {
    invoiceNumber: string;
    paymentLinkUrl: string;
    amount: number;
    currency: string;
  };
  message?: string;
}

interface IremboPayApiInvoiceResponse {
  message: string;
  success: boolean;
  data: {
    invoiceNumber: string;
    paymentLinkUrl: string;
    amount: number;
    currency: string;
    transactionId: string;
    createdAt: string;
    updatedAt: string;
    description: string;
    type: string;
    paymentStatus: string;
    customer: {
      fullName: string;
      phoneNumber: string;
    };
    createdBy: string;
    paymentAccountIdentifier: string;
    paymentItems: Array<{
      quantity: number;
      unitAmount: number;
      code: string;
    }>;
  };
}

interface IremboPayPushResponse {
  success: boolean;
  data: {
    transactionId: string;
    status: string;
  };
  message?: string;
}

interface IremboPayStatusResponse {
  status: string;
  amount: number;
  currency: string;
  reference: string;
  failure_reason?: string;
}

@Injectable()
export class IrremboPayGateway {
  private readonly logger = new Logger(IrremboPayGateway.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get('IREMBOPAY_BASE_URL') || '';
    this.apiKey = this.configService.get('IREMBOPAY_API_KEY') || '';
    this.secretKey = this.configService.get('IREMBOPAY_SECRET_KEY') || '';

    // Log configuration status on startup
    this.validateAndLogConfiguration();
  }

  private validateAndLogConfiguration(): void {
    const missingConfig: string[] = [];
    if (!this.baseUrl) missingConfig.push('IREMBOPAY_BASE_URL');
    if (!this.apiKey) missingConfig.push('IREMBOPAY_API_KEY');
    if (!this.secretKey) missingConfig.push('IREMBOPAY_SECRET_KEY');
  }

  async initiatePayment(
    request: PaymentGatewayRequest,
  ): Promise<PaymentGatewayResponse> {
    try {
      const invoiceResponse = await this.createInvoice(request);

      if (!invoiceResponse.success) {
        return {
          success: false,
          gatewayTransactionId: '',
          message: invoiceResponse.message || 'Invoice creation failed',
          data: invoiceResponse,
        };
      }

      // Step 2: For mobile money, initiate push payment
      if (this.isMobileMoney(request.paymentMethod)) {
        const pushResponse = (await this.initiateMobileMoneyPush(
          request.paymentAccount,
          request.paymentMethod,
          invoiceResponse.data.invoiceNumber,
        )) as IremboPayPushResponse;

        // Use invoice number as fallback if push transaction ID is not available
        const gatewayTransactionId =
          pushResponse.data?.transactionId ||
          invoiceResponse.data.invoiceNumber;

        return {
          success: true,
          gatewayTransactionId: gatewayTransactionId,
          gatewayReference: invoiceResponse.data.invoiceNumber,
          paymentUrl: invoiceResponse.data.paymentLinkUrl,
          message: pushResponse.success
            ? 'Mobile money payment initiated successfully'
            : `Invoice created but push failed: ${pushResponse.message}`,
          data: {
            invoice: invoiceResponse.data,
            pushPayment: pushResponse.data || { error: pushResponse.message },
          },
        };
      }

      // For bank payments, return invoice with payment URL
      return {
        success: true,
        gatewayTransactionId: invoiceResponse.data.invoiceNumber,
        gatewayReference: invoiceResponse.data.invoiceNumber,
        paymentUrl: invoiceResponse.data.paymentLinkUrl,
        message: 'Invoice created successfully',
        data: invoiceResponse.data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Payment gateway error';
      return {
        success: false,
        gatewayTransactionId: '',
        message: errorMessage,
        data: { error: errorMessage },
      };
    }
  }

  async getPaymentStatus(
    gatewayTransactionId: string,
  ): Promise<PaymentGatewayStatus> {
    try {
      // In a real implementation, this would make an HTTP request to IremboPay
      const response = (await this.makeHttpRequest(
        `/payments/${gatewayTransactionId}/status`,
        undefined,
        {
          'irembopay-secretKey': this.secretKey,
          'X-API-Version': '2',
        },
        'GET',
      )) as IremboPayStatusResponse;

      return {
        gatewayTransactionId,
        status: this.mapStatus(response.status),
        amount: response.amount,
        currency: response.currency,
        gatewayReference: response.reference,
        failureReason: response.failure_reason,
        data: response,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Status check failed';
      return {
        gatewayTransactionId,
        status: 'failed' as const,
        failureReason: errorMessage,
      };
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    try {
      // In a real implementation, verify the webhook signature using HMAC
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');

      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Webhook verification failed';
      return false;
    }
  }

  private async createInvoice(
    request: PaymentGatewayRequest,
  ): Promise<IremboPayInvoiceResponse> {
    try {
      const invoicePayload = {
        transactionId: request.reference,
        paymentItems: [
          {
            code: `${process.env.IREMBOPAY_DEFAULT_PRODUCT_CODE}`,
            quantity: 1,
            unitAmount: request.amount,
          },
        ],
        paymentAccountIdentifier: this.getPaymentAccountIdentifier(),
        description: request.description || 'Copay payment invoice on IremboPay',
        customer: {
          phoneNumber: this.extractPhoneNumber(request.paymentAccount),
          name: 'Copay User',
        },
        language: 'EN',
      };

      const response = (await this.makeHttpRequest(
        '/payments/invoices',
        invoicePayload,
        {
          'Content-Type': 'application/json',
          'irembopay-secretKey': this.secretKey,
          'X-API-Version': '2',
        },
      )) as IremboPayApiInvoiceResponse;

      return {
        success: true,
        data: {
          invoiceNumber: response.data.invoiceNumber,
          paymentLinkUrl: response.data.paymentLinkUrl,
          amount: response.data.amount,
          currency: response.data.currency,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Invoice creation failed';

      return {
        success: false,
        message: errorMessage,
        data: {
          invoiceNumber: '',
          paymentLinkUrl: '',
          amount: 0,
          currency: 'RWF',
        },
      };
    }
  }

  private async initiateMobileMoneyPush(
    accountIdentifier: string,
    paymentMethod: string,
    invoiceNumber: string,
  ): Promise<any> {
    try {
      const formattedPhone = this.formatPhoneNumber(accountIdentifier);
      const iremboProvider = this.mapToIremboProvider(paymentMethod);

      // Validate phone number format for production
      if (!this.isValidRwandaPhoneNumber(formattedPhone)) {
        const errorMsg = `Invalid Rwanda phone number format: ${formattedPhone}`;
        return {
          success: false,
          message: errorMsg,
          data: null,
        };
      }

      const pushPayload = {
        accountIdentifier: formattedPhone,
        paymentProvider: iremboProvider,
        invoiceNumber: invoiceNumber,
        transactionReference: `COPAY_${Date.now()}`,
      };

      const response = (await this.makeHttpRequest(
        '/payments/transactions/initiate',
        pushPayload,
        {
          'Content-Type': 'application/json',
          'irembopay-secretKey': this.secretKey,
          'X-API-Version': '2',
        },
      )) as IremboPayPushResponse['data'];

      console.log(response);

      return {
        success: true,
        data: response,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Mobile money push failed',
        data: null,
      };
    }
  }

  private isValidRwandaPhoneNumber(phoneNumber: string): boolean {
    // validation: 07XXXXXXXX (10 digits)
    const rwandaMobileRegex = /^07[0-9]{8}$/;
    return rwandaMobileRegex.test(phoneNumber);
  }

  private isMobileMoney(paymentMethod: string): boolean {
    return ['MOBILE_MONEY_MTN', 'MOBILE_MONEY_AIRTEL'].includes(paymentMethod);
  }

  private mapToIremboProvider(paymentMethod: string): string {
    const mapping: Record<string, string> = {
      MOBILE_MONEY_MTN: 'MTN',
      MOBILE_MONEY_AIRTEL: 'AIRTEL',
    };
    return mapping[paymentMethod] || paymentMethod;
  }

  private getPaymentAccountIdentifier(): string {
    const accountId = this.configService.get('IREMBOPAY_PAYMENT_ACCOUNT_ID');
    return accountId || 'PACOUNT-2025';
  }

  private extractPhoneNumber(paymentAccount: string): string {
    // Extract phone number from payment account (remove + if present)
    return paymentAccount.replace(/^\+/, '');
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Ensure phone number is in Rwanda format (07xxxxxxxx)
    let cleaned = phoneNumber.replace(/^\+?250/, '');

    // Remove any non-digit characters
    cleaned = cleaned.replace(/\D/g, '');

    // Ensure it starts with 07 for Rwanda mobile numbers
    if (!cleaned.startsWith('07')) {
      // If it's a 9-digit number starting with 7, add 0
      if (cleaned.startsWith('7') && cleaned.length === 9) {
        cleaned = '0' + cleaned;
      } else {
        // Take last 8 digits and prepend 07
        cleaned = '07' + cleaned.slice(-8);
      }
    }

    return cleaned;
  }

  private mapPaymentMethod(paymentMethod: string): string {
    const mapping: Record<string, string> = {
      // IremboPay handles all these payment methods through their unified API
      MOBILE_MONEY_MTN: 'mtn_momo',
      MOBILE_MONEY_AIRTEL: 'airtel_money',
      BANK_BK: 'bank_of_kigali',
      BANK_IM: 'im_bank',
      BANK_ECOBANK: 'ecobank',
    };

    return mapping[paymentMethod] || 'unknown';
  }

  private mapStatus(
    status: string,
  ): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
    const statusMapping: Record<
      string,
      'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
    > = {
      pending: 'pending',
      processing: 'processing',
      successful: 'completed',
      completed: 'completed',
      failed: 'failed',
      error: 'failed',
      cancelled: 'cancelled',
      timeout: 'failed',
    };

    return statusMapping[status?.toLowerCase()] || 'pending';
  }

  private async makeHttpRequest(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>,
    method: string = 'POST',
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...headers,
        },
      };

      if (data && method !== 'GET') {
        requestOptions.body = JSON.stringify(data);
      }

      const response = await fetch(url, requestOptions);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${JSON.stringify(responseData)}`,
        );
      }

      return responseData;
    } catch (error) {
      throw error;
    }
  }
}
