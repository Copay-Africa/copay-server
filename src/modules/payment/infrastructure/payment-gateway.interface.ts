export interface PaymentGatewayRequest {
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentAccount: string; // Phone number for mobile money, account for banks
  reference: string;
  description?: string;
  callbackUrl: string;
  email?: string; // Customer email for invoice creation
  customerName?: string; // Customer name for invoice creation
}

export interface PaymentGatewayResponse {
  success: boolean;
  gatewayTransactionId: string;
  gatewayReference?: string;
  paymentUrl?: string; // For redirect-based payments
  message?: string;
  data?: Record<string, any>;
}

export interface PaymentGatewayStatus {
  gatewayTransactionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  amount?: number;
  currency?: string;
  failureReason?: string;
  gatewayReference?: string;
  data?: Record<string, any>;
}

export abstract class PaymentGatewayInterface {
  abstract initiatePayment(
    request: PaymentGatewayRequest,
  ): Promise<PaymentGatewayResponse>;
  abstract getPaymentStatus(
    gatewayTransactionId: string,
  ): Promise<PaymentGatewayStatus>;
  abstract verifyWebhook(payload: any, signature: string): boolean;
}
