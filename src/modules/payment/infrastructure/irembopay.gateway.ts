/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
    this.apiKey = this.configService.get('IREMBOPAY_PUBLIC_KEY') || '';
    this.secretKey = this.configService.get('IREMBOPAY_SECRET_KEY') || '';

    // Log configuration status on startup
    this.validateAndLogConfiguration();
  }

  private validateAndLogConfiguration(): void {
    const missingConfig: string[] = [];
    if (!this.baseUrl) missingConfig.push('IREMBOPAY_BASE_URL');
    if (!this.apiKey) missingConfig.push('IREMBOPAY_PUBLIC_KEY');
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

      // Only create invoice, external service will handle payment processing
      return {
        success: true,
        gatewayTransactionId: invoiceResponse.data.invoiceNumber,
        gatewayReference: invoiceResponse.data.invoiceNumber,
        paymentUrl: invoiceResponse.data.paymentLinkUrl,
        message: 'Invoice created successfully',
        data: {
          invoice: invoiceResponse.data,
          paymentMethod: request.paymentMethod,
          paymentAccount: request.paymentAccount,
        },
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
      const response = (await this.makeRequest(
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
    } catch {
      return false;
    }
  }

  private async createInvoice(
    request: PaymentGatewayRequest,
  ): Promise<IremboPayInvoiceResponse> {
    try {
      const productCode = process.env.IREMBOPAY_DEFAULT_PRODUCT_CODE;

      // Log the product code for debugging
      this.logger.log(`Creating invoice with product code: ${productCode}`);

      if (!productCode) {
        this.logger.error(
          'IREMBOPAY_DEFAULT_PRODUCT_CODE is not set in environment variables',
        );
        throw new Error('Product code configuration missing');
      }

      const invoicePayload = {
        transactionId: request.reference,
        paymentAccountIdentifier: this.getAccountId(),
        customer: {
          email:
            request.email ||
            `${this.extractPhoneNumber(request.paymentAccount)}@copay.app`,
          phoneNumber: this.extractPhoneNumber(request.paymentAccount),
          name: request.customerName || 'Copay User',
        },
        paymentItems: [
          {
            unitAmount: request.amount,
            quantity: 1,
            code: productCode,
          },
        ],
        description:
          request.description || 'Copay payment invoice on IremboPay',
        expiryAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        language: 'EN',
      };

      this.logger.log(
        `Invoice payload: ${JSON.stringify(invoicePayload, null, 2)}`,
      );

      const response = (await this.makeRequest(
        '/payments/invoices',
        invoicePayload,
        {
          'Content-Type': 'application/json',
          'irembopay-secretKey': this.secretKey,
          'X-API-Version': '2',
        },
      )) as IremboPayApiInvoiceResponse;

      this.logger.log(
        `Invoice creation response: ${JSON.stringify(response, null, 2)}`,
      );

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

      this.logger.error(`Invoice creation failed: ${errorMessage}`);
      this.logger.error(`Error details: ${JSON.stringify(error, null, 2)}`);

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

  private getAccountId(): string {
    const accountId = this.configService.get<string>(
      'IREMBOPAY_PAYMENT_ACCOUNT_ID',
    );
    return accountId || 'PACOUNT-2025';
  }

  private extractPhoneNumber(paymentAccount: string): string {
    // Extract phone number from payment account (remove + if present)
    return paymentAccount.replace(/^\+/, '');
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

  private async makeRequest(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>,
    method: string = 'POST',
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

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
    const responseData: any = await response.json();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${JSON.stringify(responseData)}`,
      );
    }

    return responseData;
  }
}
