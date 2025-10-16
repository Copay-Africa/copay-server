import { Injectable } from '@nestjs/common';
import { PaymentMethodType } from '@prisma/client';
import { PaymentGatewayInterface } from './payment-gateway.interface';
import { IrremboPayGateway } from './irembopay.gateway';

@Injectable()
export class PaymentGatewayFactory {
  constructor(private irremboPayGateway: IrremboPayGateway) {}

  getGateway(paymentMethod: PaymentMethodType): PaymentGatewayInterface {
    switch (paymentMethod) {
      case PaymentMethodType.MOBILE_MONEY_MTN:
      case PaymentMethodType.MOBILE_MONEY_AIRTEL:
      case PaymentMethodType.BANK_BK:
      case PaymentMethodType.BANK_IM:
      case PaymentMethodType.BANK_ECOBANK:
        // All payment methods are processed through IremboPay's unified API
        // IremboPay handles MTN, Airtel, and all supported banks internally
        return this.irremboPayGateway;

      default:
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }
  }

  getSupportedMethods(): PaymentMethodType[] {
    return [
      PaymentMethodType.MOBILE_MONEY_MTN,
      PaymentMethodType.MOBILE_MONEY_AIRTEL,
      PaymentMethodType.BANK_BK,
      PaymentMethodType.BANK_IM,
      PaymentMethodType.BANK_ECOBANK,
    ];
  }
}
