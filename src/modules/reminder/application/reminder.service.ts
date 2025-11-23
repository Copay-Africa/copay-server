import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReminderDto } from '../presentation/dto/create-reminder.dto';
import { UpdateReminderDto } from '../presentation/dto/update-reminder.dto';
import { ReminderResponseDto } from '../presentation/dto/reminder-response.dto';
import { ReminderFilterDto } from '../presentation/dto/reminder-filter.dto';
import { ReminderSearchDto } from '../presentation/dto/reminder-search.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { ReminderStatus, UserRole } from '@prisma/client';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(private prismaService: PrismaService) {}

  async createReminder(
    createReminderDto: CreateReminderDto,
    userId: string,
    cooperativeId?: string,
  ): Promise<ReminderResponseDto> {
    try {
      // Validate payment type if provided
      if (createReminderDto.paymentTypeId) {
        const paymentType = await this.prismaService.paymentType.findUnique({
          where: { id: createReminderDto.paymentTypeId },
        });

        if (!paymentType) {
          throw new NotFoundException('Payment type not found');
        }

        if (!paymentType.isActive) {
          throw new BadRequestException('Payment type is not active');
        }

        // Use payment type's cooperative if not specified
        if (!cooperativeId) {
          cooperativeId = paymentType.cooperativeId;
        }
      }

      // Validate dates
      const reminderDate = new Date(createReminderDto.reminderDate);
      if (isNaN(reminderDate.getTime())) {
        throw new BadRequestException('Invalid reminder date format');
      }

      // Calculate next trigger date
      const nextTrigger = this.calculateNextTrigger(
        reminderDate,
        createReminderDto.advanceNoticeDays || 0,
      );

      // Prepare the data for creation
      const createData: any = {
        title: createReminderDto.title,
        description: createReminderDto.description,
        type: createReminderDto.type,
        userId,
        paymentTypeId: createReminderDto.paymentTypeId || null,
        reminderDate,
        isRecurring: createReminderDto.isRecurring || false,
        recurringPattern: createReminderDto.recurringPattern || null,
        notificationTypes: createReminderDto.notificationTypes as string[],
        advanceNoticeDays: createReminderDto.advanceNoticeDays || 0,
        customAmount: createReminderDto.customAmount || null,
        notes: createReminderDto.notes || null,
        nextTrigger,
      };

      // Only add cooperativeId if it's provided
      if (cooperativeId) {
        createData.cooperativeId = cooperativeId;
      }

      const reminder = await this.prismaService.reminder.create({
        data: createData,
        include: {
          paymentType: {
            select: {
              id: true,
              name: true,
              amount: true,
              description: true,
            },
          },
        },
      });

      return this.mapToResponseDto(reminder);
    } catch (error) {
      // Log the error for debugging
      console.error('Error creating reminder:', error);

      // Re-throw known exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new BadRequestException(
        `Failed to create reminder: ${error.message}`,
      );
    }
  }

  async findAll(
    filterDto: ReminderFilterDto,
    userId: string,
    userRole?: UserRole,
    cooperativeId?: string,
  ): Promise<PaginatedResponseDto<ReminderResponseDto>> {
    const { page, limit, skip, sortBy, sortOrder } = filterDto;

    // Build where clause based on user permissions
    const where: any = {};

    // Apply user-specific filters based on role
    if (userRole === UserRole.SUPER_ADMIN) {
      // Super admins can see all reminders
      if (cooperativeId) {
        where.cooperativeId = cooperativeId;
      }
    } else if (userRole === UserRole.ORGANIZATION_ADMIN) {
      // Org admins can see reminders in their cooperative
      where.cooperativeId = cooperativeId;
    } else {
      // Regular users can only see their own reminders
      where.userId = userId;
    }

    // Apply additional filters
    if (filterDto.type) {
      where.type = filterDto.type;
    }

    if (filterDto.status) {
      where.status = filterDto.status;
    }

    if (filterDto.paymentTypeId) {
      where.paymentTypeId = filterDto.paymentTypeId;
    }

    if (filterDto.isRecurring !== undefined) {
      where.isRecurring = filterDto.isRecurring;
    }

    if (filterDto.fromDate || filterDto.toDate) {
      where.reminderDate = {};
      if (filterDto.fromDate) {
        where.reminderDate.gte = new Date(filterDto.fromDate);
      }
      if (filterDto.toDate) {
        where.reminderDate.lte = new Date(filterDto.toDate);
      }
    }

    if (filterDto.isDue) {
      where.nextTrigger = {
        lte: new Date(),
      };
      where.status = ReminderStatus.ACTIVE;
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.nextTrigger = 'asc';
    }

    // Execute queries
    const [reminders, total] = await Promise.all([
      this.prismaService.reminder.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          paymentType: {
            select: {
              id: true,
              name: true,
              amount: true,
              description: true,
            },
          },
        },
      }),
      this.prismaService.reminder.count({ where }),
    ]);

    const reminderResponses = reminders.map((reminder) =>
      this.mapToResponseDto(reminder),
    );

    return new PaginatedResponseDto(
      reminderResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async findById(
    id: string,
    userId: string,
    userRole?: UserRole,
    cooperativeId?: string,
  ): Promise<ReminderResponseDto> {
    const reminder = await this.prismaService.reminder.findUnique({
      where: { id },
      include: {
        paymentType: {
          select: {
            id: true,
            name: true,
            amount: true,
            description: true,
          },
        },
      },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    // Check access permissions
    if (
      userRole !== UserRole.SUPER_ADMIN &&
      reminder.userId !== userId &&
      (userRole !== UserRole.ORGANIZATION_ADMIN ||
        reminder.cooperativeId !== cooperativeId)
    ) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapToResponseDto(reminder);
  }

  async updateReminder(
    id: string,
    updateReminderDto: UpdateReminderDto,
    userId: string,
    userRole?: UserRole,
    cooperativeId?: string,
  ): Promise<ReminderResponseDto> {
    const existingReminder = await this.findById(
      id,
      userId,
      userRole,
      cooperativeId,
    );

    // Validate payment type if provided
    if (updateReminderDto.paymentTypeId) {
      const paymentType = await this.prismaService.paymentType.findUnique({
        where: { id: updateReminderDto.paymentTypeId },
      });

      if (!paymentType || !paymentType.isActive) {
        throw new BadRequestException('Invalid payment type');
      }
    }

    // Calculate new next trigger if reminder date or advance notice changed
    let nextTrigger = existingReminder.nextTrigger;
    if (
      updateReminderDto.reminderDate ||
      updateReminderDto.advanceNoticeDays !== undefined
    ) {
      const reminderDate = updateReminderDto.reminderDate
        ? new Date(updateReminderDto.reminderDate)
        : existingReminder.reminderDate;
      const advanceNoticeDays =
        updateReminderDto.advanceNoticeDays !== undefined
          ? updateReminderDto.advanceNoticeDays
          : existingReminder.advanceNoticeDays;

      nextTrigger = this.calculateNextTrigger(reminderDate, advanceNoticeDays);
    }

    const updatedData: any = {
      ...updateReminderDto,
      ...(nextTrigger && { nextTrigger }),
    };

    // Convert notification types if provided
    if (updateReminderDto.notificationTypes) {
      updatedData.notificationTypes =
        updateReminderDto.notificationTypes as string[];
    }

    // Convert reminder date if provided
    if (updateReminderDto.reminderDate) {
      updatedData.reminderDate = new Date(updateReminderDto.reminderDate);
    }

    const reminder = await this.prismaService.reminder.update({
      where: { id },
      data: updatedData,
      include: {
        paymentType: {
          select: {
            id: true,
            name: true,
            amount: true,
            description: true,
          },
        },
      },
    });

    return this.mapToResponseDto(reminder);
  }

  async deleteReminder(
    id: string,
    userId: string,
    userRole?: UserRole,
    cooperativeId?: string,
  ): Promise<void> {
    // Check if reminder exists and user has access
    await this.findById(id, userId, userRole, cooperativeId);

    await this.prismaService.reminder.delete({
      where: { id },
    });
  }

  async searchReminders(
    searchDto: ReminderSearchDto,
    userId: string,
    cooperativeId: string,
    userRole: UserRole,
  ): Promise<PaginatedResponseDto<ReminderResponseDto>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'nextTrigger',
      sortOrder = 'asc',
    } = searchDto;
    const skip = (page - 1) * limit;

    // Build where clause based on user role and search criteria
    const whereClause: Record<string, any> = {};

    // Role-based access control
    if (userRole === UserRole.TENANT) {
      whereClause.userId = userId;
    } else if (userRole === UserRole.ORGANIZATION_ADMIN) {
      whereClause.cooperativeId = cooperativeId;
    } else if (userRole === UserRole.SUPER_ADMIN) {
      // Super admin can search across all cooperatives
      if (searchDto.cooperativeId) {
        whereClause.cooperativeId = searchDto.cooperativeId;
      }
    }

    // Apply search filters
    if (searchDto.search) {
      whereClause.OR = [
        { title: { contains: searchDto.search, mode: 'insensitive' } },
        { description: { contains: searchDto.search, mode: 'insensitive' } },
        { notes: { contains: searchDto.search, mode: 'insensitive' } },
      ];
    }

    if (searchDto.type) {
      whereClause.type = searchDto.type;
    }

    if (searchDto.status) {
      whereClause.status = searchDto.status;
    }

    if (searchDto.paymentTypeId) {
      whereClause.paymentTypeId = searchDto.paymentTypeId;
    }

    if (searchDto.userId) {
      whereClause.userId = searchDto.userId;
    }

    if (searchDto.isRecurring !== undefined) {
      whereClause.isRecurring = searchDto.isRecurring;
    }

    // Date range filtering (created date)
    if (searchDto.fromDate || searchDto.toDate) {
      whereClause.createdAt = {};
      if (searchDto.fromDate) {
        whereClause.createdAt.gte = new Date(searchDto.fromDate);
      }
      if (searchDto.toDate) {
        whereClause.createdAt.lte = new Date(searchDto.toDate);
      }
    }

    // Reminder scheduled date filtering
    if (searchDto.reminderFromDate || searchDto.reminderToDate) {
      whereClause.reminderDate = {};
      if (searchDto.reminderFromDate) {
        whereClause.reminderDate.gte = new Date(searchDto.reminderFromDate);
      }
      if (searchDto.reminderToDate) {
        whereClause.reminderDate.lte = new Date(searchDto.reminderToDate);
      }
    }

    // Build sort clause
    const orderBy: Record<string, any> = {};
    orderBy[sortBy] = sortOrder;

    const [reminders, total] = await Promise.all([
      this.prismaService.reminder.findMany({
        where: whereClause,
        include: {
          paymentType: {
            select: {
              id: true,
              name: true,
              amount: true,
              description: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prismaService.reminder.count({ where: whereClause }),
    ]);

    const data = reminders.map((reminder) => this.mapToResponseDto(reminder));

    return new PaginatedResponseDto(data, total, page, limit);
  }

  // Get reminders that are due for processing
  async getDueReminders(): Promise<ReminderResponseDto[]> {
    const now = new Date();

    const reminders = await this.prismaService.reminder.findMany({
      where: {
        status: ReminderStatus.ACTIVE,
        nextTrigger: {
          lte: now,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        paymentType: {
          select: {
            id: true,
            name: true,
            amount: true,
            description: true,
          },
        },
      },
      orderBy: {
        nextTrigger: 'asc',
      },
    });

    return reminders.map((reminder) => this.mapToResponseDto(reminder));
  }

  // Mark reminder as triggered and calculate next trigger for recurring reminders
  async markAsTriggered(id: string): Promise<void> {
    const reminder = await this.prismaService.reminder.findUnique({
      where: { id },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    const updateData: any = {
      lastTriggered: new Date(),
      triggerCount: reminder.triggerCount + 1,
    };

    // Calculate next trigger for recurring reminders
    if (reminder.isRecurring && reminder.recurringPattern) {
      updateData.nextTrigger = this.calculateRecurringNextTrigger(
        reminder.reminderDate,
        reminder.recurringPattern,
        reminder.triggerCount + 1,
        reminder.advanceNoticeDays,
      );
    } else {
      // For non-recurring reminders, mark as completed
      updateData.status = ReminderStatus.COMPLETED;
      updateData.nextTrigger = null;
    }

    await this.prismaService.reminder.update({
      where: { id },
      data: updateData,
    });
  }

  private calculateNextTrigger(
    reminderDate: Date,
    advanceNoticeDays: number,
  ): Date {
    if (!reminderDate || isNaN(reminderDate.getTime())) {
      throw new BadRequestException('Invalid reminder date provided');
    }

    if (advanceNoticeDays < 0 || advanceNoticeDays > 30) {
      throw new BadRequestException(
        'Advance notice days must be between 0 and 30',
      );
    }

    const trigger = new Date(reminderDate);
    trigger.setDate(trigger.getDate() - advanceNoticeDays);
    return trigger;
  }

  private calculateRecurringNextTrigger(
    originalReminderDate: Date,
    pattern: string,
    occurrenceCount: number,
    advanceNoticeDays: number,
  ): Date {
    const nextReminderDate = new Date(originalReminderDate);

    switch (pattern.toUpperCase()) {
      case 'DAILY':
        nextReminderDate.setDate(nextReminderDate.getDate() + occurrenceCount);
        break;
      case 'WEEKLY':
        nextReminderDate.setDate(
          nextReminderDate.getDate() + occurrenceCount * 7,
        );
        break;
      case 'MONTHLY':
        nextReminderDate.setMonth(
          nextReminderDate.getMonth() + occurrenceCount,
        );
        break;
      case 'YEARLY':
        nextReminderDate.setFullYear(
          nextReminderDate.getFullYear() + occurrenceCount,
        );
        break;
      default:
        throw new BadRequestException(`Invalid recurring pattern: ${pattern}`);
    }

    return this.calculateNextTrigger(nextReminderDate, advanceNoticeDays);
  }

  /**
   * Get overdue reminders that need immediate attention
   */
  async getOverdueReminders(): Promise<any[]> {
    const now = new Date();
    
    return this.prismaService.reminder.findMany({
      where: {
        status: ReminderStatus.ACTIVE,
        reminderDate: {
          lt: now,
        },
        type: {
          in: ['PAYMENT_DUE', 'PAYMENT_UPCOMING'] as any[],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            fcmToken: true,
          },
        },
        paymentType: true,
      },
      orderBy: {
        reminderDate: 'asc',
      },
    });
  }

  /**
   * Update reminders to overdue status when past due date
   */
  async updateOverdueReminders() {
    const now = new Date();
    
    return this.prismaService.reminder.updateMany({
      where: {
        status: ReminderStatus.ACTIVE,
        reminderDate: {
          lt: now,
        },
        type: {
          in: ['PAYMENT_DUE', 'PAYMENT_UPCOMING'] as any[],
        },
      },
      data: {
        type: 'PAYMENT_OVERDUE' as any,
        updatedAt: now,
      },
    });
  }

  /**
   * Update reminder type (useful for status transitions)
   */
  async updateReminderType(reminderId: string, newType: any) {
    return this.prismaService.reminder.update({
      where: { id: reminderId },
      data: {
        type: newType,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark reminders as completed when related payments are made
   */
  async markRemindersAsCompletedForPaidPayments() {
    // This would require payment status integration
    // For now, we'll implement a basic version that's disabled
    // const completedPayments = await this.prismaService.payment.findMany({
    //   where: {
    //     status: 'COMPLETED', // Assuming this status exists
    //   },
    //   select: {
    //     id: true,
    //     cooperativeId: true,
    //   },
    // });

    let completedCount = 0;
    // Disable this functionality for now due to schema mismatch
    // for (const payment of completedPayments) {
    //   // Implementation would go here
    // }

    return { count: completedCount };
  }

  /**
   * Generate upcoming payment reminders based on cooperative payment frequencies
   */
  async generateUpcomingPaymentReminders(): Promise<number> {
    let generatedCount = 0;

    try {
      // Get basic cooperative info without complex relations
      const cooperatives = await this.prismaService.cooperative.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          paymentFrequency: true,
          billingDayOfMonth: true,
          billingDayOfYear: true,
        },
      });

      // For now, generate basic reminders for cooperatives with payment frequencies
      for (const cooperative of cooperatives) {
        if (cooperative.paymentFrequency) {
          try {
            const reminderDates = this.calculateReminderDatesForFrequency(
              cooperative.paymentFrequency as any,
              cooperative.billingDayOfMonth || undefined,
              cooperative.billingDayOfYear || undefined,
            );
            
            // Log the reminder generation for this cooperative
            this.logger.debug(
              `Generated ${reminderDates.length} reminder dates for cooperative ${cooperative.id} (${cooperative.paymentFrequency})`,
            );
            
            generatedCount += reminderDates.length;
          } catch (error) {
            this.logger.error(
              `Error calculating reminders for cooperative ${cooperative.id}: ${error.message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error in generateUpcomingPaymentReminders: ${error.message}`,
      );
    }

    return generatedCount;
  }

  /**
   * Calculate reminder dates based on cooperative payment frequency
   */
  private calculateReminderDatesForFrequency(
    paymentFrequency: 'DAILY' | 'MONTHLY' | 'YEARLY',
    billingDayOfMonth?: number,
    billingDayOfYear?: Date,
  ): Array<{
    dueDate: Date;
    triggerDate: Date;
    advanceDays: number;
    isUrgent: boolean;
    startRange: Date;
    endRange: Date;
  }> {
    const now = new Date();
    const reminders: any[] = [];

    switch (paymentFrequency) {
      case 'DAILY':
        // For daily payments, send reminder 2 hours before end of day
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);
        
        const dailyTrigger = new Date(tomorrow);
        dailyTrigger.setHours(22, 0, 0, 0); // 2 hours before midnight
        
        reminders.push({
          dueDate: tomorrow,
          triggerDate: dailyTrigger,
          advanceDays: 0,
          isUrgent: false,
          startRange: now,
          endRange: tomorrow,
        });
        break;

      case 'MONTHLY':
        // For monthly payments, send reminders 7 days and 3 days before due date
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const billingDay = Math.min(billingDayOfMonth || 1, 28); // Ensure valid day
        
        // This month's due date
        const thisMonthDue = new Date(currentYear, currentMonth, billingDay, 23, 59, 59);
        if (thisMonthDue > now) {
          const weekBeforeTrigger = new Date(thisMonthDue);
          weekBeforeTrigger.setDate(weekBeforeTrigger.getDate() - 7);
          
          const threeDaysTrigger = new Date(thisMonthDue);
          threeDaysTrigger.setDate(threeDaysTrigger.getDate() - 3);
          
          if (weekBeforeTrigger >= now) {
            reminders.push({
              dueDate: thisMonthDue,
              triggerDate: weekBeforeTrigger,
              advanceDays: 7,
              isUrgent: false,
              startRange: weekBeforeTrigger,
              endRange: new Date(weekBeforeTrigger.getTime() + 24 * 60 * 60 * 1000),
            });
          }
          
          if (threeDaysTrigger >= now) {
            reminders.push({
              dueDate: thisMonthDue,
              triggerDate: threeDaysTrigger,
              advanceDays: 3,
              isUrgent: true,
              startRange: threeDaysTrigger,
              endRange: new Date(threeDaysTrigger.getTime() + 24 * 60 * 60 * 1000),
            });
          }
        }
        
        // Next month's due date
        const nextMonthDue = new Date(currentYear, currentMonth + 1, billingDay, 23, 59, 59);
        const nextWeekTrigger = new Date(nextMonthDue);
        nextWeekTrigger.setDate(nextWeekTrigger.getDate() - 7);
        
        if (nextWeekTrigger >= now) {
          reminders.push({
            dueDate: nextMonthDue,
            triggerDate: nextWeekTrigger,
            advanceDays: 7,
            isUrgent: false,
            startRange: nextWeekTrigger,
            endRange: new Date(nextWeekTrigger.getTime() + 24 * 60 * 60 * 1000),
          });
        }
        break;

      case 'YEARLY':
        // For yearly payments, send reminders 30 days and 7 days before
        const billingDate = billingDayOfYear ? new Date(billingDayOfYear) : new Date();
        const thisYearDue = new Date(
          now.getFullYear(),
          billingDate.getMonth(),
          billingDate.getDate(),
          23, 59, 59
        );
        
        if (thisYearDue <= now) {
          thisYearDue.setFullYear(thisYearDue.getFullYear() + 1);
        }
        
        const monthBeforeTrigger = new Date(thisYearDue);
        monthBeforeTrigger.setDate(monthBeforeTrigger.getDate() - 30);
        
        const weekBeforeYearlyTrigger = new Date(thisYearDue);
        weekBeforeYearlyTrigger.setDate(weekBeforeYearlyTrigger.getDate() - 7);
        
        if (monthBeforeTrigger >= now) {
          reminders.push({
            dueDate: thisYearDue,
            triggerDate: monthBeforeTrigger,
            advanceDays: 30,
            isUrgent: false,
            startRange: monthBeforeTrigger,
            endRange: new Date(monthBeforeTrigger.getTime() + 24 * 60 * 60 * 1000),
          });
        }
        
        if (weekBeforeYearlyTrigger >= now) {
          reminders.push({
            dueDate: thisYearDue,
            triggerDate: weekBeforeYearlyTrigger,
            advanceDays: 7,
            isUrgent: true,
            startRange: weekBeforeYearlyTrigger,
            endRange: new Date(weekBeforeYearlyTrigger.getTime() + 24 * 60 * 60 * 1000),
          });
        }
        break;
    }

    return reminders;
  }

  /**
   * Clean up old completed/cancelled reminders
   */
  async cleanupOldReminders(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3); // Remove reminders older than 3 months

    const result = await this.prismaService.reminder.deleteMany({
      where: {
        status: {
          in: [ReminderStatus.COMPLETED, ReminderStatus.CANCELLED],
        },
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get reminder processing statistics
   */
  async getReminderStats(): Promise<{
    totalActive: number;
    totalOverdue: number;
    totalCompleted: number;
    dueToday: number;
    lastProcessedAt: string;
  }> {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );

    const [totalActive, totalOverdue, totalCompleted, dueToday] =
      await Promise.all([
        this.prismaService.reminder.count({
          where: { status: ReminderStatus.ACTIVE },
        }),
        this.prismaService.reminder.count({
          where: {
            status: ReminderStatus.ACTIVE,
            type: 'PAYMENT_OVERDUE' as any,
          },
        }),
        this.prismaService.reminder.count({
          where: { status: ReminderStatus.COMPLETED },
        }),
        this.prismaService.reminder.count({
          where: {
            status: ReminderStatus.ACTIVE,
            nextTrigger: {
              gte: startOfDay,
              lt: endOfDay,
            },
          },
        }),
      ]);

    // Get the most recent reminder update timestamp as a proxy for last processed
    const lastProcessed = await this.prismaService.reminder.findFirst({
      where: { lastTriggered: { not: null } },
      orderBy: { lastTriggered: 'desc' },
      select: { lastTriggered: true },
    });

    return {
      totalActive,
      totalOverdue,
      totalCompleted,
      dueToday,
      lastProcessedAt: lastProcessed?.lastTriggered?.toISOString() || 'Never',
    };
  }

  private mapToResponseDto(reminder: any): ReminderResponseDto {
    return {
      id: reminder.id,
      title: reminder.title,
      description: reminder.description,
      type: reminder.type,
      status: reminder.status,
      userId: reminder.userId,
      cooperativeId: reminder.cooperativeId,
      paymentTypeId: reminder.paymentTypeId,
      paymentType: reminder.paymentType,
      reminderDate: reminder.reminderDate,
      isRecurring: reminder.isRecurring,
      recurringPattern: reminder.recurringPattern,
      notificationTypes: reminder.notificationTypes,
      advanceNoticeDays: reminder.advanceNoticeDays,
      customAmount: reminder.customAmount,
      notes: reminder.notes,
      lastTriggered: reminder.lastTriggered,
      nextTrigger: reminder.nextTrigger,
      triggerCount: reminder.triggerCount,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
    };
  }
}
