import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReminderDto } from '../presentation/dto/create-reminder.dto';
import { UpdateReminderDto } from '../presentation/dto/update-reminder.dto';
import { ReminderResponseDto } from '../presentation/dto/reminder-response.dto';
import { ReminderFilterDto } from '../presentation/dto/reminder-filter.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { ReminderStatus, UserRole } from '@prisma/client';

@Injectable()
export class ReminderService {
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
    let nextReminderDate = new Date(originalReminderDate);

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
