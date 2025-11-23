import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderService } from '../application/reminder.service';
import { NotificationService } from '../../notification/application/notification.service';
import { ReminderStatus, ReminderType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);
  private isProcessing = false;

  constructor(
    private reminderService: ReminderService,
    private notificationService: NotificationService,
    private prismaService: PrismaService,
  ) {}

  /**
   * Process due reminders every minute for real-time notifications
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueReminders() {
    if (this.isProcessing) {
      this.logger.debug('Reminder processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    this.logger.debug('Starting due reminder processing...');
    
    try {
      const dueReminders = await this.reminderService.getDueReminders();
      
      if (dueReminders.length > 0) {
        this.logger.log(`Found ${dueReminders.length} due reminders`);
        
        for (const reminder of dueReminders) {
          try {
            await this.processIndividualReminder(reminder);
            this.logger.debug(`Successfully processed reminder ${reminder.id}`);
          } catch (error) {
            this.logger.error(
              `Failed to process reminder ${reminder.id}:`,
              error.message,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Error processing due reminders:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check for overdue reminders and update their status every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processOverdueReminders() {
    this.logger.debug('Starting overdue reminder processing...');
    
    try {
      const overdueCount = await this.updateOverdueReminders();
      
      if (overdueCount > 0) {
        this.logger.log(`Updated ${overdueCount} reminders to overdue status`);
        
        // Send overdue notifications
        const overdueReminders = await this.reminderService.getOverdueReminders();
        
        for (const reminder of overdueReminders) {
          try {
            // Update reminder type to PAYMENT_OVERDUE for enhanced notifications
            await this.reminderService.updateReminderType(
              reminder.id,
              ReminderType.PAYMENT_OVERDUE,
            );
            
            await this.processIndividualReminder(reminder, true);
            this.logger.debug(`Sent overdue notification for reminder ${reminder.id}`);
          } catch (error) {
            this.logger.error(
              `Failed to send overdue notification for reminder ${reminder.id}:`,
              error.message,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Error processing overdue reminders:', error.message);
    }
  }

  /**
   * Retry failed notifications every 15 minutes
   */
  @Cron('0 */15 * * * *') // Every 15 minutes
  async retryFailedNotifications() {
    this.logger.debug('Starting failed notification retry process...');
    
    try {
      await this.notificationService.retryFailedNotifications();
      this.logger.debug('Completed failed notification retry process');
    } catch (error) {
      this.logger.error('Error retrying failed notifications:', error.message);
    }
  }

  /**
   * Process completed payments and mark related reminders as completed every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processCompletedPayments() {
    this.logger.debug('Starting completed payment processing...');
    
    try {
      const completedCount = await this.reminderService.markRemindersAsCompletedForPaidPayments();
      
      if (completedCount && completedCount.count > 0) {
        this.logger.log(`Marked ${completedCount.count} reminders as completed due to payments`);
      }
    } catch (error) {
      this.logger.error('Error processing completed payments:', error.message);
    }
  }

  /**
   * Generate upcoming payment reminders daily at 8 AM
   */
  @Cron('0 8 * * *') // Daily at 8:00 AM
  async generateUpcomingReminders() {
    this.logger.log('Starting upcoming reminder generation...');
    
    try {
      const generatedCount = await this.reminderService.generateUpcomingPaymentReminders();
      
      if (generatedCount > 0) {
        this.logger.log(`Generated ${generatedCount} upcoming payment reminders`);
      }
    } catch (error) {
      this.logger.error('Error generating upcoming reminders:', error.message);
    }
  }

  /**
   * Clean up old completed/cancelled reminders weekly
   */
  @Cron('0 2 * * 0') // Every Sunday at 2:00 AM
  async cleanupOldReminders() {
    this.logger.log('Starting reminder cleanup...');
    
    try {
      const deletedCount = await this.reminderService.cleanupOldReminders();
      
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old reminders`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up old reminders:', error.message);
    }
  }

  /**
   * Process individual reminder with notification sending
   */
  private async processIndividualReminder(reminder: any, isOverdue = false): Promise<void> {
    // Get user details for the reminder
    const user = await this.getUserForReminder(reminder.userId);

    if (!user) {
      this.logger.warn(`User not found for reminder ${reminder.id}`);
      return;
    }

    // Send notification
    await this.notificationService.sendReminderNotification(
      reminder,
      user,
    );
    
    // Mark as triggered
    await this.reminderService.markAsTriggered(reminder.id);
    
    // Log the action
    const action = isOverdue ? 'overdue notification' : 'reminder notification';
    this.logger.debug(`Sent ${action} for reminder ${reminder.id} (${reminder.title})`);
  }

  /**
   * Update reminders that have passed their due date to overdue status
   */
  private async updateOverdueReminders(): Promise<number> {
    try {
      const result = await this.reminderService.updateOverdueReminders();
      return result.count || 0;
    } catch (error) {
      this.logger.error('Error updating overdue reminders:', error.message);
      return 0;
    }
  }

  /**
   * Get user details for reminder notification
   */
  private async getUserForReminder(userId: string) {
    return await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        email: true,
        fcmToken: true,
      },
    });
  }

  /**
   * Manual trigger for immediate reminder processing (useful for testing)
   */
  async triggerReminderProcessing(): Promise<{
    processed: number;
    overdue: number;
    errors: number;
  }> {
    this.logger.log('Manual reminder processing triggered');
    
    const results = {
      processed: 0,
      overdue: 0,
      errors: 0,
    };

    try {
      // Process due reminders
      const dueReminders = await this.reminderService.getDueReminders();
      
      for (const reminder of dueReminders) {
        try {
          await this.processIndividualReminder(reminder);
          results.processed++;
        } catch (error) {
          results.errors++;
          this.logger.error(`Error processing reminder ${reminder.id}:`, error.message);
        }
      }

      // Process overdue reminders
      const overdueCount = await this.updateOverdueReminders();
      results.overdue = overdueCount;

    } catch (error) {
      this.logger.error('Error in manual reminder processing:', error.message);
      throw error;
    }

    this.logger.log(`Manual processing completed: ${JSON.stringify(results)}`);
    return results;
  }
}
