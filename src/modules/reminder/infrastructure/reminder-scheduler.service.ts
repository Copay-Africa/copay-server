import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderService } from '../application/reminder.service';
import { NotificationService } from '../application/notification.service';

@Injectable()
export class ReminderSchedulerService {
  constructor(
    private reminderService: ReminderService,
    private notificationService: NotificationService,
  ) {}

  // Run every 15 minutes to check for due reminders
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processReminders(): Promise<void> {
    try {
      console.log('Processing due reminders...');

      const dueReminders = await this.reminderService.getDueReminders();

      console.log(`Found ${dueReminders.length} due reminders`);

      for (const reminder of dueReminders) {
        try {
          // Get user details for the reminder
          const user = await this.getUserForReminder(reminder.userId);

          if (user) {
            // Send notifications for the reminder
            await this.notificationService.sendReminderNotification(
              reminder,
              user,
            );

            // Mark reminder as triggered
            await this.reminderService.markAsTriggered(reminder.id);

            console.log(
              `Processed reminder ${reminder.id} for user ${user.phone}`,
            );
          }
        } catch (error) {
          console.error(
            `Failed to process reminder ${reminder.id}:`,
            error.message,
          );
        }
      }
    } catch (error) {
      console.error('Error processing reminders:', error.message);
    }
  }

  // Run every hour to retry failed notifications
  @Cron(CronExpression.EVERY_HOUR)
  async retryFailedNotifications(): Promise<void> {
    try {
      console.log('Retrying failed notifications...');
      await this.notificationService.retryFailedNotifications();
    } catch (error) {
      console.error('Error retrying notifications:', error.message);
    }
  }

  private async getUserForReminder(userId: string) {
    // This would typically be injected, but for simplicity we'll access Prisma directly
    const { PrismaService } = await import('../../../prisma/prisma.service');
    const prisma = new PrismaService();

    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
  }
}
