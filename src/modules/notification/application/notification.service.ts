import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SmsService } from '../../sms/application/sms.service';
import {
  FcmService,
  PushNotificationPayload,
} from '../infrastructure/fcm.service';
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
  complaintId?: string;
  roomAssignmentId?: string;
}

@Injectable()
export class NotificationService {
  private notificationGateway: any;

  constructor(
    private prismaService: PrismaService,
    private smsService: SmsService,
    private fcmService: FcmService,
  ) {}

  // Lazy injection to avoid circular dependency
  setNotificationGateway(gateway: any) {
    this.notificationGateway = gateway;
  }

  async sendReminderNotification(reminder: any, user: any): Promise<void> {
    const { notificationTypes } = reminder;
    const isOverdue = reminder.type === ReminderType.PAYMENT_OVERDUE;

    // Send urgent real-time notification for overdue reminders
    if (isOverdue && this.notificationGateway) {
      try {
        await this.notificationGateway.sendUrgentReminderNotification(
          user.id,
          {
            id: reminder.id,
            title: reminder.title,
            message: `URGENT: ${reminder.title} - Your payment is overdue!`,
            type: reminder.type,
            isOverdue: true,
          },
        );
      } catch (error) {
        console.error(
          `Failed to send urgent WebSocket notification for reminder ${reminder.id}:`,
          error.message,
        );
      }
    }

    // Send standard notifications based on configured types
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

  async sendPaymentNotification(
    payment: any,
    user: any,
    notificationType: NotificationType,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      await this.sendNotification(notificationType, { title, message }, user, {
        userId: user.id,
        cooperativeId: payment.cooperativeId,
        paymentId: payment.id,
      });
    } catch (error) {
      console.error(
        `Failed to send ${notificationType} notification for payment ${payment.id}:`,
        error.message,
      );
    }
  }

  async sendAnnouncementNotification(
    notificationType: NotificationType,
    contentData: { title: string; message: string },
    user: any,
    context: NotificationContext & { announcementId?: string },
  ): Promise<void> {
    await this.sendNotification(notificationType, contentData, user, context);
  }

  async sendComplaintNotification(
    complaint: any,
    user: any,
    notificationTypes: NotificationType[],
    title: string,
    message: string,
  ): Promise<void> {
    const context: NotificationContext = {
      userId: user.id,
      cooperativeId: complaint.cooperativeId,
      complaintId: complaint.id,
    };

    for (const type of notificationTypes) {
      try {
        await this.sendNotification(
          type,
          { title, message, complaint },
          user,
          context,
        );
        console.log(
          `✅ ${type} notification sent for complaint ${complaint.id}`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to send ${type} notification for complaint ${complaint.id}:`,
          error.message,
        );
      }
    }
  }

  async sendRoomAssignmentNotification(
    assignment: any,
    user: any,
    notificationTypes: NotificationType[],
    title: string,
    message: string,
  ): Promise<void> {
    const context: NotificationContext = {
      userId: user.id,
      cooperativeId: assignment.cooperativeId,
      roomAssignmentId: assignment.id,
    };

    for (const type of notificationTypes) {
      try {
        await this.sendNotification(
          type,
          { title, message, roomAssignment: assignment },
          user,
          context,
        );
        console.log(
          `✅ ${type} notification sent for room assignment ${assignment.id}`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to send ${type} notification for room assignment ${assignment.id}:`,
          error.message,
        );
      }
    }
  }

  private async sendNotification(
    type: NotificationType,
    contentData: any,
    user: any,
    context: NotificationContext,
  ): Promise<void> {
    const { title, message } = this.buildNotificationContent(contentData);
    const recipient = this.getRecipient(type, user);

    if (!recipient) {
      console.warn(
        `No recipient found for ${type} notification for user ${user.id}`,
      );
      return;
    }

    // Create notification record
    const notificationData: any = {
      type,
      status: NotificationStatus.PENDING,
      title,
      message,
      userId: context.userId,
      cooperativeId: context.cooperativeId,
      recipient,
    };

    // Add related entity IDs
    if (context.reminderId) {
      notificationData.reminderId = context.reminderId;
    }
    if (context.paymentId) {
      notificationData.paymentId = context.paymentId;
    }
    // Note: complaintId would require schema update, using metadata for now
    if (context.complaintId) {
      notificationData.metadata = {
        complaintId: context.complaintId,
      };
    }

    const notification = await this.prismaService.notification.create({
      data: notificationData,
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
          await this.sendPushNotification(notification, title, message, user);
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
    // In-app notifications are stored in database and retrieved by frontend
    console.log(`In-app notification created for user ${notification.userId}`);

    // Send real-time notification via WebSocket if gateway is available
    if (this.notificationGateway) {
      try {
        const wasDelivered = await this.notificationGateway.sendNotificationToUser(
          notification.userId,
          {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: {
              notificationId: notification.id,
              reminderId: notification.reminderId,
              paymentId: notification.paymentId,
              cooperativeId: notification.cooperativeId,
              metadata: notification.metadata,
            },
          },
        );

        // If delivered via WebSocket, mark as delivered immediately
        if (wasDelivered) {
          await this.prismaService.notification.update({
            where: { id: notification.id },
            data: {
              sentAt: new Date(),
              status: NotificationStatus.DELIVERED,
              deliveredAt: new Date(),
            },
          });
          return;
        }
      } catch (error) {
        console.error(
          `Failed to send real-time notification for ${notification.id}:`,
          error.message,
        );
      }
    }

    // Mark as sent (stored in database for later retrieval)
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
    user: any,
  ): Promise<void> {
    if (!user.fcmToken) {
      throw new Error('User does not have FCM token for push notifications');
    }

    const payload: PushNotificationPayload = {
      title,
      body: message,
      data: {
        notificationId: notification.id,
        type: notification.metadata?.complaintId ? 'complaint' : 'reminder',
        userId: user.id,
        ...(notification.metadata?.complaintId && {
          complaintId: notification.metadata.complaintId,
        }),
      },
    };

    const result = await this.fcmService.sendPushNotification(
      user.fcmToken,
      payload,
    );

    if (!result.success) {
      throw new Error(result.error || 'Push notification sending failed');
    }

    // Update notification with FCM response
    await this.prismaService.notification.update({
      where: { id: notification.id },
      data: {
        providerResponse: JSON.parse(JSON.stringify(result)),
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

  private buildNotificationContent(contentData: any): {
    title: string;
    message: string;
  } {
    // If content data already has title and message, use them
    if (contentData.title && contentData.message) {
      return {
        title: contentData.title,
        message: contentData.message,
      };
    }

    // Otherwise, build from reminder data
    const paymentTypeName = contentData.paymentType?.name || 'Payment';
    const amount = contentData.customAmount || contentData.paymentType?.amount;

    let title = '';
    let message = '';

    switch (contentData.type) {
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
        title = contentData.title || 'Payment Reminder';
        message =
          contentData.description ||
          `Don't forget about your ${paymentTypeName}`;
        break;

      default:
        title = 'Payment Reminder';
        message = `You have a payment reminder: ${contentData.title}`;
    }

    if (contentData.notes) {
      message += `\n\nNote: ${contentData.notes}`;
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
        return user.id; // User ID for in-app notifications
      case NotificationType.PUSH_NOTIFICATION:
        return user.fcmToken || null; // FCM token for push notifications
      default:
        return null;
    }
  }

  // Get in-app notifications for a user
  async getInAppNotifications(userId: string, limit = 20): Promise<any[]> {
    return this.prismaService.notification.findMany({
      where: {
        userId,
        type: NotificationType.IN_APP,
        status: {
          in: [NotificationStatus.SENT, NotificationStatus.DELIVERED],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        reminder: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
          },
        },
      },
    });
  }

  // Mark in-app notification as read
  async markNotificationAsRead(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    await this.prismaService.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        type: NotificationType.IN_APP,
      },
      data: {
        status: NotificationStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });
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
        case NotificationType.PUSH_NOTIFICATION:
          await this.sendPushNotification(
            notification,
            notification.title,
            notification.message,
            notification.user,
          );
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
