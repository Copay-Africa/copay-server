import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentGatewayRequest,
  PaymentGatewayResponse,
  PaymentGatewayStatus,
} from './payment-gateway.interface';

import { PaymentMethodType } from '@prisma/client';

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
    this.logger.log('=== IREMBOPAY CONFIGURATION STATUS ===');
    this.logger.log(`Base URL: ${this.baseUrl || 'NOT SET'}`);
    this.logger.log(`API Key: ${this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NOT SET'}`);
    this.logger.log(`Secret Key: ${this.secretKey ? `${this.secretKey.substring(0, 10)}...` : 'NOT SET'}`);
    
    const missingConfig: string[] = [];
    if (!this.baseUrl) missingConfig.push('IREMBOPAY_BASE_URL');
    if (!this.apiKey) missingConfig.push('IREMBOPAY_API_KEY');
    if (!this.secretKey) missingConfig.push('IREMBOPAY_SECRET_KEY');
    
    if (missingConfig.length > 0) {
      this.logger.error(`❌ Missing configuration: ${missingConfig.join(', ')}`);
    } else {
      this.logger.log('✅ All configuration variables are set');
    }
  }

  async initiatePayment(
    request: PaymentGatewayRequest,
  ): Promise<PaymentGatewayResponse> {
    try {
      this.logger.log('=== IREMBOPAY GATEWAY: PAYMENT INITIATION ===');
      this.logger.log(`Payment Reference: ${request.reference}`);
      this.logger.log(`Payment Method: ${request.paymentMethod}`);
      this.logger.log(`Payment Account: ${request.paymentAccount}`);
      this.logger.log(`Amount: ${request.amount} ${request.currency}`);
      this.logger.log(`Description: ${request.description}`);

      // Step 1: Create Invoice
      this.logger.log('=== STEP 1: CREATING INVOICE ===');
      const invoiceResponse = (await this.createInvoice(
        request,
      )) as IremboPayInvoiceResponse;

      this.logger.log(`Invoice Response: ${JSON.stringify(invoiceResponse, null, 2)}`);

      if (!invoiceResponse.success) {
        this.logger.error(`Invoice creation failed: ${invoiceResponse.message}`);
        return {
          success: false,
          gatewayTransactionId: '',
          message: invoiceResponse.message || 'Invoice creation failed',
          data: invoiceResponse,
        };
      }

      this.logger.log(`Invoice created successfully: ${invoiceResponse.data.invoiceNumber}`);

      // Step 2: For mobile money, initiate push payment
      if (this.isMobileMoney(request.paymentMethod)) {
        this.logger.log('=== STEP 2: INITIATING MOBILE MONEY PUSH ===');
        this.logger.log(`Phone Number: ${request.paymentAccount}`);
        this.logger.log(`Payment Method: ${request.paymentMethod}`);
        this.logger.log(`Invoice Number: ${invoiceResponse.data.invoiceNumber}`);

        const pushResponse = (await this.initiateMobileMoneyPush(
          request.paymentAccount,
          request.paymentMethod,
          invoiceResponse.data.invoiceNumber,
        )) as IremboPayPushResponse;

        this.logger.log(`Push Response: ${JSON.stringify(pushResponse, null, 2)}`);

        if (pushResponse.success) {
          this.logger.log('=== MOBILE MONEY PUSH SUCCESSFUL ===');
          this.logger.log(`Transaction ID: ${pushResponse.data?.transactionId}`);
          this.logger.log('🚀 PUSH NOTIFICATION SENT TO PHONE!');
        } else {
          this.logger.error(`Mobile money push failed: ${pushResponse.message}`);
        }

        // Use invoice number as fallback if push transaction ID is not available
        const gatewayTransactionId = pushResponse.data?.transactionId || invoiceResponse.data.invoiceNumber;
        this.logger.log(`Using Gateway Transaction ID: ${gatewayTransactionId}`);

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
      this.logger.error(`IremboPay initiation failed: ${errorMessage}`);
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
      this.logger.log(`Checking IremboPay status: ${gatewayTransactionId}`);

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
      this.logger.error(`IremboPay status check failed: ${errorMessage}`);
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
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');

      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Webhook verification failed';
      this.logger.error(`Webhook verification failed: ${errorMessage}`);
      return false;
    }
  }

  private async createInvoice(request: PaymentGatewayRequest): Promise<any> {
    try {
      this.logger.log(`Creating IremboPay invoice: ${request.reference}`);

      const invoicePayload = {
        transactionId: request.reference,
        paymentItems: [
          {
            code: 'PC-def4cc3de8',
            quantity: 1,
            unitAmount: request.amount,
          },
        ],
        paymentAccountIdentifier: this.getPaymentAccountIdentifier(),
        description: request.description || 'Co-Pay payment',
        customer: {
          phoneNumber: this.extractPhoneNumber(request.paymentAccount),
          name: 'Co-Pay User',
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
      )) as any;

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Invoice creation failed';
      this.logger.error(`Invoice creation failed: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
        data: { error: errorMessage },
      };
    }
  }

  private async initiateMobileMoneyPush(
    accountIdentifier: string,
    paymentMethod: string,
    invoiceNumber: string,
  ): Promise<any> {
    try {
      this.logger.log('=== INITIATING MOBILE MONEY PUSH ===');
      this.logger.log(`Invoice Number: ${invoiceNumber}`);
      this.logger.log(`Account Identifier (raw): ${accountIdentifier}`);
      this.logger.log(`Payment Method: ${paymentMethod}`);

      const formattedPhone = this.formatPhoneNumber(accountIdentifier);
      const iremboProvider = this.mapToIremboProvider(paymentMethod);

      this.logger.log(`Formatted Phone: ${formattedPhone}`);
      this.logger.log(`Irembo Provider: ${iremboProvider}`);

      const pushPayload = {
        accountIdentifier: formattedPhone,
        paymentProvider: iremboProvider,
        invoiceNumber: invoiceNumber,
        invoice_number: invoiceNumber, // Try both naming conventions
        transactionReference: `copay_${Date.now()}`,
      };

      this.logger.log('=== PUSH PAYLOAD ===');
      this.logger.log(JSON.stringify(pushPayload, null, 2));

      this.logger.log('=== MAKING HTTP REQUEST TO IREMBOPAY ===');
      this.logger.log(`URL: ${this.baseUrl}/payments/transactions/initiate`);
      this.logger.log(`Secret Key: ${this.secretKey ? `${this.secretKey.substring(0, 10)}...` : 'NOT SET'}`);

      const response = await this.makeHttpRequest(
        '/payments/transactions/initiate',
        pushPayload,
        {
          'Content-Type': 'application/json',
          'irembopay-secretKey': this.secretKey,
          'X-API-Version': '2',
        },
      );

      this.logger.log('=== PUSH RESPONSE FROM IREMBOPAY ===');
      this.logger.log(JSON.stringify(response, null, 2));

      return {
        success: true,
        data: response,
      };
    } catch (error: any) {
      this.logger.error(`Mobile money push failed: ${error.message}`);
      return {
        success: false,
        message: error.message || 'Mobile money push failed',
        data: null,
      };
    }
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
    // This should be configured based on your IremboPay merchant account
    return (
      this.configService.get('IREMBOPAY_PAYMENT_ACCOUNT_ID') ||
      'default_account'
    );
  }

  private extractPhoneNumber(paymentAccount: string): string {
    // Extract phone number from payment account (remove + if present)
    return paymentAccount.replace(/^\+/, '');
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Ensure phone number is in Rwanda format (07xxxxxxxx)
    let cleaned = phoneNumber.replace(/^\+?250/, '');
    if (!cleaned.startsWith('07')) {
      cleaned = '07' + cleaned.slice(-8);
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

    this.logger.log('=== HTTP REQUEST TO IREMBOPAY ===');
    this.logger.log(`URL: ${url}`);
    this.logger.log(`Method: ${method}`);
    this.logger.log(`Base URL: ${this.baseUrl}`);
    this.logger.log(`API Key: ${this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NOT SET'}`);

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

      this.logger.log('=== REQUEST OPTIONS ===');
      this.logger.log(`Headers: ${JSON.stringify(requestOptions.headers, null, 2)}`);
      this.logger.log(`Body: ${requestOptions.body || 'No body'}`);

      this.logger.log('=== SENDING REQUEST ===');
      const response = await fetch(url, requestOptions);
      
      this.logger.log('=== RESPONSE RECEIVED ===');
      this.logger.log(`Status: ${response.status}`);
      this.logger.log(`Status Text: ${response.statusText}`);
      this.logger.log(`Headers: ${JSON.stringify([...response.headers.entries()], null, 2)}`);

      const responseData = await response.json();

      this.logger.log('=== RESPONSE DATA ===');
      this.logger.log(JSON.stringify(responseData, null, 2));

      if (!response.ok) {
        this.logger.error(`HTTP Error: ${response.status} - ${response.statusText}`);
        this.logger.error(`Error Response: ${JSON.stringify(responseData)}`);
        throw new Error(
          `HTTP ${response.status}: ${JSON.stringify(responseData)}`,
        );
      }

      this.logger.log('✅ HTTP request successful');
      return responseData;
    } catch (error) {
      this.logger.error(`❌ HTTP request failed to ${url}:`);
      this.logger.error(`Error: ${error instanceof Error ? error.message : error}`);
      this.logger.error(`Endpoint: ${endpoint}`);
      this.logger.error(`Data: ${JSON.stringify(data)}`);
      throw error;
    }
  }
}
