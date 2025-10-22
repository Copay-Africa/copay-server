import { Injectable, Logger } from '@nestjs/common';
import { FdiSmsProvider } from '../infrastructure/fdi-sms.provider';
import { SmsResult } from '../infrastructure/sms.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly fdiSmsProvider: FdiSmsProvider) {}

  async sendSms(
    to: string,
    message: string,
    messageRef?: string,
  ): Promise<SmsResult> {
    this.logger.log(`Sending SMS to ${to}: ${message.substring(0, 50)}...`);

    try {
      const result = await this.fdiSmsProvider.sendSms(to, message, messageRef);

      if (result.success) {
        this.logger.log(
          `SMS sent successfully to ${to}. Cost: ${result.cost || 'Unknown'}, Gateway Ref: ${result.gatewayRef || 'None'}`,
        );
      } else {
        this.logger.warn(`Failed to send SMS to ${to}: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error sending SMS to ${to}:`, error.stack);
      return {
        success: false,
        message: 'Internal error while sending SMS',
        error: error.message,
      };
    }
  }

  async sendPinResetSms(phoneNumber: string, pin: string): Promise<SmsResult> {
    const message = `Your COPAY PIN reset code is: ${pin}. This code expires in 15 minutes. Do not share this code with anyone.`;
    return this.sendSms(phoneNumber, message);
  }

  async sendWelcomeSms(
    phoneNumber: string,
    firstName: string,
  ): Promise<SmsResult> {
    const message = `Welcome to COPAY, ${firstName}! Your account has been successfully created. Thank you for joining our cooperative savings platform.`;
    return this.sendSms(phoneNumber, message);
  }

  async sendTransactionSms(
    phoneNumber: string,
    amount: number,
    type: string,
  ): Promise<SmsResult> {
    const message = `COPAY Transaction: ${type} of RWF ${amount.toLocaleString()} has been processed successfully. Thank you for using COPAY.`;
    return this.sendSms(phoneNumber, message);
  }

  async sendPinResetSuccessSms(phoneNumber: string): Promise<SmsResult> {
    const message = `Your COPAY PIN has been successfully reset. Your account is now secure with the new PIN. Contact support if you did not make this change.`;
    return this.sendSms(phoneNumber, message);
  }
}
