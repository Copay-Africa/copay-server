import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SmsProvider,
  SmsResult,
  FdiAuthRequest,
  FdiAuthResponse,
  FdiSmsRequest,
  FdiSmsResponse,
} from './sms.interface';

@Injectable()
export class FdiSmsProvider implements SmsProvider {
  private readonly logger = new Logger(FdiSmsProvider.name);
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly senderId: string;
  private readonly enabled: boolean;

  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('sms.fdi.baseUrl') ||
      'https://messaging.fdibiz.com/api/v1';
    this.username = this.configService.get<string>('sms.fdi.username') || '';
    this.password = this.configService.get<string>('sms.fdi.password') || '';
    this.senderId =
      this.configService.get<string>('sms.fdi.senderId') || 'COPAY';
    this.enabled = this.configService.get<boolean>('sms.fdi.enabled') || false;
  }

  private async authenticate(): Promise<boolean> {
    if (!this.username || !this.password) {
      this.logger.error('SMS credentials not configured');
      return false;
    }

    // Check if we have a valid token
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      new Date() < this.tokenExpiresAt
    ) {
      return true;
    }

    try {
      const authRequest: FdiAuthRequest = {
        api_username: this.username,
        api_password: this.password,
      };

      this.logger.log('Authenticating with FDI SMS API');

      const response = await fetch(`${this.baseUrl}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(authRequest),
      });

      if (!response.ok) {
        throw new Error(
          `Authentication failed: ${response.status} ${response.statusText}`,
        );
      }

      const authResponse: FdiAuthResponse = await response.json();

      if (!authResponse.success) {
        throw new Error('Authentication failed: Invalid credentials');
      }

      this.accessToken = authResponse.access_token;
      this.tokenExpiresAt = new Date(authResponse.expires_at);

      this.logger.log('Successfully authenticated with FDI SMS API');
      return true;
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`, error.stack);
      return false;
    }
  }

  async sendSms(
    to: string,
    message: string,
    messageRef?: string,
  ): Promise<SmsResult> {
    if (!this.enabled) {
      this.logger.warn('SMS service is disabled');
      return {
        success: false,
        message: 'SMS service is disabled',
        error: 'SMS_DISABLED',
      };
    }

    // Authenticate first
    const isAuthenticated = await this.authenticate();
    if (!isAuthenticated) {
      return {
        success: false,
        message: 'Failed to authenticate with SMS provider',
        error: 'AUTHENTICATION_FAILED',
      };
    }

    try {
      // Clean and format phone number
      let cleanPhoneNumber = to.replace(/[\s\+]/g, '');

      // Handle Rwanda local numbers (convert to international format)
      if (cleanPhoneNumber.length === 9 || cleanPhoneNumber.length === 10) {
        if (cleanPhoneNumber.startsWith('0')) {
          cleanPhoneNumber = '250' + cleanPhoneNumber.substring(1);
        } else if (cleanPhoneNumber.length === 9) {
          cleanPhoneNumber = '250' + cleanPhoneNumber;
        }
      }

      // Generate message reference if not provided
      const msgRef =
        messageRef ||
        `copay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const smsRequest: FdiSmsRequest = {
        msisdn: cleanPhoneNumber,
        message: message,
        sender_id: this.senderId,
        msgRef: msgRef,
      };

      this.logger.log(
        `Sending SMS to ${cleanPhoneNumber} with msgRef: ${msgRef}`,
      );

      const response = await fetch(`${this.baseUrl}/mt/single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(smsRequest),
      });

      if (!response.ok) {
        // If unauthorized, clear token and retry once
        if (response.status === 401 || response.status === 403) {
          this.logger.warn('Token expired, retrying authentication');
          this.accessToken = null;
          this.tokenExpiresAt = null;

          const retryAuth = await this.authenticate();
          if (retryAuth) {
            // Retry the SMS request with new token
            const retryResponse = await fetch(`${this.baseUrl}/mt/single`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${this.accessToken}`,
              },
              body: JSON.stringify(smsRequest),
            });

            if (!retryResponse.ok) {
              throw new Error(
                `SMS request failed after retry: ${retryResponse.status} ${retryResponse.statusText}`,
              );
            }

            const retryData: FdiSmsResponse = await retryResponse.json();
            return this.handleSmsResponse(retryData);
          }
        }

        throw new Error(
          `SMS request failed: ${response.status} ${response.statusText}`,
        );
      }

      const responseData: FdiSmsResponse = await response.json();
      return this.handleSmsResponse(responseData);
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`, error.stack);
      return {
        success: false,
        message: 'Failed to send SMS',
        error: error.message,
      };
    }
  }

  private handleSmsResponse(responseData: FdiSmsResponse): SmsResult {
    this.logger.log(`SMS response: ${JSON.stringify(responseData)}`);

    if (responseData.success) {
      return {
        success: true,
        message: responseData.message || 'SMS sent successfully',
        messageId: responseData.msgRef,
        gatewayRef: responseData.gatewayRef,
        cost: responseData.cost,
      };
    } else {
      return {
        success: false,
        message: responseData.message || 'Failed to send SMS',
        error: 'SMS_SEND_FAILED',
      };
    }
  }
}
