/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

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
  private firebaseApp: admin.app.App;
  private isFirebaseInitialized = false;
  private useMockImplementation = false;

  constructor(private configService: ConfigService) {
    // Don't initialize Firebase in constructor for serverless environments
    // Initialize lazily when needed
  }

  private async initializeFirebase(): Promise<void> {
    if (this.isFirebaseInitialized || this.useMockImplementation) {
      return;
    }

    try {
      const projectId = this.configService.get<string>('firebase.projectId');
      const serviceAccount = this.configService.get<any>(
        'firebase.serviceAccount',
      );

      if (
        !serviceAccount ||
        !projectId ||
        !serviceAccount.private_key ||
        !serviceAccount.client_email
      ) {
        console.error(
          '❌ Firebase configuration incomplete. Required: projectId, private_key, client_email',
        );
        this.useMockImplementation = true;
        return;
      }

      // Validate service account structure
      const requiredFields = [
        'type',
        'project_id',
        'private_key',
        'client_email',
      ];
      const missingFields = requiredFields.filter(
        (field) => !serviceAccount[field],
      );

      if (missingFields.length > 0) {
        console.error(
          `❌ Firebase service account missing fields: ${missingFields.join(', ')}`,
        );
        this.useMockImplementation = true;
        return;
      }

      if (!admin.apps.length) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId,
        });
      } else {
        this.firebaseApp = admin.app();
      }

      this.isFirebaseInitialized = true;
      console.log(
        `✅ Firebase Admin SDK initialized successfully for project: ${projectId}`,
      );
    } catch (error) {
      console.error(
        '❌ Failed to initialize Firebase Admin SDK:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      console.error('Error details:', error);
      this.useMockImplementation = true;
    }
  }

  async sendPushNotification(
    fcmToken: string,
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    try {
      // Initialize Firebase if not already done
      await this.initializeFirebase();

      // Use mock implementation if Firebase is not properly initialized
      if (this.useMockImplementation || !this.isFirebaseInitialized) {
        console.log('Mock Push Notification:', {
          token: fcmToken.substring(0, 20) + '...',
          payload,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          success: true,
          messageId: `mock_message_${Date.now()}`,
        };
      }

      // REAL FCM IMPLEMENTATION
      if (!this.firebaseApp) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#2196F3',
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              category: 'payment_reminder',
            },
          },
        },
      };

      const response = await admin.messaging().send(message);

      return {
        success: true,
        messageId: response,
      };
    } catch (error) {
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

      // Initialize Firebase if not already done
      await this.initializeFirebase();

      // Use mock validation if Firebase is not properly initialized
      if (this.useMockImplementation || !this.isFirebaseInitialized) {
        console.log(
          `Mock FCM token validation for: ${fcmToken.substring(0, 20)}...`,
        );
        return true;
      }

      // Real FCM token validation
      // Note: Firebase Admin SDK doesn't have a direct token validation method
      // We can try to send a dry-run message to validate the token
      const dryRunMessage: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: 'Validation',
          body: 'Token validation',
        },
      };

      await admin.messaging().send(dryRunMessage, true); // dry-run = true
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
