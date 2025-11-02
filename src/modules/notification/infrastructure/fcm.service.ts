import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface PushNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class FcmService {
  constructor(private configService: ConfigService) {}

  async sendPushNotification(
    fcmToken: string,
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    try {
      // For now, return a mock success response
      // TODO: Implement actual FCM sending when Firebase Admin SDK is installed

      console.log('Mock Push Notification:', {
        token: fcmToken.substring(0, 20) + '...',
        payload,
      });

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      return {
        success: true,
        messageId: `mock_message_${Date.now()}`,
      };
    } catch (error) {
      console.error('Push notification send error:', error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendPushNotificationToMultipleTokens(
    fcmTokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{
    successCount: number;
    failureCount: number;
    results: PushNotificationResult[];
  }> {
    const results: PushNotificationResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const token of fcmTokens) {
      const result = await this.sendPushNotification(token, payload);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return {
      successCount,
      failureCount,
      results,
    };
  }

  async validateFcmToken(fcmToken: string): Promise<boolean> {
    try {
      if (!fcmToken || fcmToken.length < 10) {
        return false;
      }

      // Mock validation - returns true for properly formatted tokens
      console.log(
        `Mock FCM token validation for: ${fcmToken.substring(0, 20)}...`,
      );
      return true;
    } catch (error) {
      console.error('FCM token validation error:', error.message);
      return false;
    }
  }

  createReminderNotificationPayload(
    reminderType: string,
    paymentTypeName: string,
    amount?: number,
    customTitle?: string,
    customMessage?: string,
  ): PushNotificationPayload {
    let title = '';
    let body = '';

    if (customTitle && customMessage) {
      title = customTitle;
      body = customMessage;
    } else {
      switch (reminderType) {
        case 'PAYMENT_DUE':
          title = `${paymentTypeName} Due`;
          body = `Your ${paymentTypeName} payment is due${
            amount ? ` (RWF ${amount.toLocaleString()})` : ''
          }. Tap to pay now.`;
          break;

        case 'PAYMENT_OVERDUE':
          title = `${paymentTypeName} Overdue!`;
          body = `Your ${paymentTypeName} payment is overdue${
            amount ? ` (RWF ${amount.toLocaleString()})` : ''
          }. Please pay immediately.`;
          break;

        case 'PAYMENT_UPCOMING':
          title = `${paymentTypeName} Due Soon`;
          body = `Your ${paymentTypeName} payment is due soon${
            amount ? ` (RWF ${amount.toLocaleString()})` : ''
          }. Don't forget!`;
          break;

        default:
          title = 'Payment Reminder';
          body = `You have a payment reminder for ${paymentTypeName}`;
      }
    }

    return {
      title,
      body,
      data: {
        type: 'payment_reminder',
        paymentType: paymentTypeName,
        amount: amount?.toString() || '',
        reminderType,
      },
    };
  }
}
