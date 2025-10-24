import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SmsService } from '../../sms/application/sms.service';
import {
  NotificationType,
  NotificationStatus,
  ReminderType,
} from '@prisma/client';

export interface NotificationContext {
  userId: string;
  cooperativeId?: string;
  reminderId?: string;
  paymentId?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    private prismaService: PrismaService,
    private smsService: SmsService,
  ) {}

  async sendReminderNotification(reminder: any, user: any): Promise<void> {
    const { notificationTypes } = reminder;

    for (const type of notificationTypes) {
      try {
        await this.sendNotification(type as NotificationType, reminder, user, {
          userId: user.id,
          cooperativeId: reminder.cooperativeId,
          reminderId: reminder.id,
        });
      } catch (error) {
        console.error(
          `Failed to send ${type} notification for reminder ${reminder.id}:`,
          error.message,
        );
      }
    }
  }

  private async sendNotification(
    type: NotificationType,
    reminder: any,
    user: any,
    context: NotificationContext,
  ): Promise<void> {
    const { title, message } = this.buildNotificationContent(reminder);
    const recipient = this.getRecipient(type, user);

    if (!recipient) {
      console.warn(
        `No recipient found for ${type} notification for user ${user.id}`,
      );
      return;
    }

    // Create notification record
    const notification = await this.prismaService.notification.create({
      data: {
        type,
        status: NotificationStatus.PENDING,
        title,
        message,
        userId: context.userId,
        cooperativeId: context.cooperativeId,
        reminderId: context.reminderId,
        paymentId: context.paymentId,
        recipient,
      },
    });

    try {
      // Send the notification based on type
      switch (type) {
        case NotificationType.SMS:
          await this.sendSmsNotification(notification, message);
          break;
        case NotificationType.EMAIL:
          await this.sendEmailNotification(notification, title, message);
          break;
        case NotificationType.IN_APP:
          await this.sendInAppNotification(notification);
          break;
        case NotificationType.PUSH_NOTIFICATION:
          await this.sendPushNotification(notification, title, message);
          break;
        default:
          throw new Error(`Unsupported notification type: ${type}`);
      }

      // Mark as sent
      await this.updateNotificationStatus(
        notification.id,
        NotificationStatus.SENT,
      );
    } catch (error) {
      // Mark as failed
      await this.updateNotificationStatus(
        notification.id,
        NotificationStatus.FAILED,
        error.message,
      );
      throw error;
    }
  }

  private async sendSmsNotification(
    notification: any,
    message: string,
  ): Promise<void> {
    const result = await this.smsService.sendSms(
      notification.recipient,
      message,
    );

    if (!result.success) {
      throw new Error(result.error || 'SMS sending failed');
    }

    // Update notification with provider response
    await this.prismaService.notification.update({
      where: { id: notification.id },
      data: {
        providerResponse: JSON.parse(JSON.stringify(result)),
        sentAt: new Date(),
      },
    });
  }

  private async sendEmailNotification(
    notification: any,
    title: string,
    message: string,
  ): Promise<void> {
    // TODO: Implement email sending logic
    console.log(`Email notification: ${title} - ${message}`);

    // For now, just mark as sent
    await this.prismaService.notification.update({
      where: { id: notification.id },
      data: {
        sentAt: new Date(),
      },
    });
  }

  private async sendInAppNotification(notification: any): Promise<void> {
    // TODO: Implement in-app notification logic (WebSocket, etc.)
    console.log(`In-app notification created for user ${notification.userId}`);

    // For now, just mark as sent
    await this.prismaService.notification.update({
      where: { id: notification.id },
      data: {
        sentAt: new Date(),
      },
    });
  }

  private async sendPushNotification(
    notification: any,
    title: string,
    message: string,
  ): Promise<void> {
    // TODO: Implement push notification logic (FCM, APNS, etc.)
    console.log(`Push notification: ${title} - ${message}`);

    // For now, just mark as sent
    await this.prismaService.notification.update({
      where: { id: notification.id },
      data: {
        sentAt: new Date(),
      },
    });
  }

  private async updateNotificationStatus(
    notificationId: string,
    status: NotificationStatus,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: any = { status };

    if (status === NotificationStatus.FAILED) {
      updateData.failedAt = new Date();
      updateData.errorMessage = errorMessage;
    } else if (status === NotificationStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    await this.prismaService.notification.update({
      where: { id: notificationId },
      data: updateData,
    });
  }

  private buildNotificationContent(reminder: any): {
    title: string;
    message: string;
  } {
    const paymentTypeName = reminder.paymentType?.name || 'Payment';
    const amount = reminder.customAmount || reminder.paymentType?.amount;

    let title = '';
    let message = '';

    switch (reminder.type) {
      case ReminderType.PAYMENT_DUE:
        title = `${paymentTypeName} Due Reminder`;
        message = `Your ${paymentTypeName} is due${
          amount ? ` (Amount: RWF ${amount.toLocaleString()})` : ''
        }. Please make your payment on time.`;
        break;

      case ReminderType.PAYMENT_OVERDUE:
        title = `${paymentTypeName} Overdue!`;
        message = `Your ${paymentTypeName} is overdue${
          amount ? ` (Amount: RWF ${amount.toLocaleString()})` : ''
        }. Please pay immediately to avoid penalties.`;
        break;

      case ReminderType.PAYMENT_UPCOMING:
        title = `${paymentTypeName} Due Soon`;
        message = `Your ${paymentTypeName} will be due soon${
          amount ? ` (Amount: RWF ${amount.toLocaleString()})` : ''
        }. Don't forget to make your payment.`;
        break;

      case ReminderType.CUSTOM:
        title = reminder.title || 'Payment Reminder';
        message =
          reminder.description || `Don't forget about your ${paymentTypeName}`;
        break;

      default:
        title = 'Payment Reminder';
        message = `You have a payment reminder: ${reminder.title}`;
    }

    if (reminder.notes) {
      message += `\n\nNote: ${reminder.notes}`;
    }

    return { title, message };
  }

  private getRecipient(type: NotificationType, user: any): string | null {
    switch (type) {
      case NotificationType.SMS:
        return user.phone || null;
      case NotificationType.EMAIL:
        return user.email || null;
      case NotificationType.IN_APP:
      case NotificationType.PUSH_NOTIFICATION:
        return user.id; // User ID for in-app and push notifications
      default:
        return null;
    }
  }

  // Process failed notifications for retry
  async retryFailedNotifications(): Promise<void> {
    const failedNotifications = await this.prismaService.notification.findMany({
      where: {
        status: NotificationStatus.FAILED,
        retryCount: {
          lt: 3, // Max 3 retries
        },
        nextRetryAt: {
          lte: new Date(),
        },
      },
      include: {
        user: true,
        reminder: true,
      },
    });

    for (const notification of failedNotifications) {
      try {
        await this.retryNotification(notification);
      } catch (error) {
        console.error(
          `Failed to retry notification ${notification.id}:`,
          error.message,
        );
      }
    }
  }

  private async retryNotification(notification: any): Promise<void> {
    const retryCount = notification.retryCount + 1;
    const nextRetryAt = new Date();
    nextRetryAt.setMinutes(nextRetryAt.getMinutes() + retryCount * 15); // Exponential backoff

    try {
      // Try to send again based on type
      switch (notification.type) {
        case NotificationType.SMS:
          await this.sendSmsNotification(notification, notification.message);
          break;
        // Add other types as needed
      }

      await this.updateNotificationStatus(
        notification.id,
        NotificationStatus.SENT,
      );
    } catch (error) {
      // Update retry info
      await this.prismaService.notification.update({
        where: { id: notification.id },
        data: {
          retryCount,
          nextRetryAt: retryCount < 3 ? nextRetryAt : null,
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }
}
