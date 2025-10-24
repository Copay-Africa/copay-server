import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateActivityDto } from '../presentation/dto/create-activity.dto';
import { ActivityResponseDto } from '../presentation/dto/activity-response.dto';
import { ActivityFilterDto } from '../presentation/dto/activity-filter.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { ActivityType, UserRole } from '@prisma/client';

export interface ActivityContext {
  userId: string;
  cooperativeId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityService {
  constructor(private prismaService: PrismaService) {}

  async createActivity(
    createActivityDto: CreateActivityDto,
    context: ActivityContext,
  ): Promise<ActivityResponseDto> {
    const activity = await this.prismaService.activity.create({
      data: {
        ...createActivityDto,
        userId: context.userId,
        cooperativeId: context.cooperativeId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        occurredAt: createActivityDto.occurredAt
          ? new Date(createActivityDto.occurredAt)
          : new Date(),
      },
    });

    return this.mapToResponseDto(activity);
  }

  async findAll(
    filterDto: ActivityFilterDto,
    currentUserId: string,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<PaginatedResponseDto<ActivityResponseDto>> {
    const { page, limit, skip, sortBy, sortOrder } = filterDto;

    // Build where clause
    const where: any = {};

    // Apply user-specific filters based on role
    if (currentUserRole === UserRole.SUPER_ADMIN) {
      // Super admins can see all activities
      if (filterDto.userId) {
        where.userId = filterDto.userId;
      }
      if (filterDto.cooperativeId) {
        where.cooperativeId = filterDto.cooperativeId;
      }
    } else if (currentUserRole === UserRole.ORGANIZATION_ADMIN) {
      // Org admins can see activities in their cooperative
      where.cooperativeId = currentCooperativeId;
      if (filterDto.userId) {
        where.userId = filterDto.userId;
      }
    } else {
      // Regular users can only see their own activities
      where.userId = currentUserId;
    }

    // Apply additional filters
    if (filterDto.type) {
      where.type = filterDto.type;
    }

    if (filterDto.fromDate || filterDto.toDate) {
      where.occurredAt = {};
      if (filterDto.fromDate) {
        where.occurredAt.gte = new Date(filterDto.fromDate);
      }
      if (filterDto.toDate) {
        where.occurredAt.lte = new Date(filterDto.toDate);
      }
    }

    if (filterDto.isSecurityEvent !== undefined) {
      where.isSecurityEvent = filterDto.isSecurityEvent;
    }

    if (filterDto.riskLevel) {
      where.riskLevel = filterDto.riskLevel;
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.occurredAt = 'desc';
    }

    // Execute queries
    const [activities, total] = await Promise.all([
      this.prismaService.activity.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          cooperative: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      this.prismaService.activity.count({ where }),
    ]);

    const activityResponses = activities.map((activity) =>
      this.mapToResponseDto(activity),
    );

    return new PaginatedResponseDto(
      activityResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async findUserActivities(
    userId: string,
    filterDto: ActivityFilterDto,
  ): Promise<PaginatedResponseDto<ActivityResponseDto>> {
    const { page, limit, skip, sortBy, sortOrder } = filterDto;

    const where: any = { userId };

    // Apply filters
    if (filterDto.type) {
      where.type = filterDto.type;
    }

    if (filterDto.cooperativeId) {
      where.cooperativeId = filterDto.cooperativeId;
    }

    if (filterDto.fromDate || filterDto.toDate) {
      where.occurredAt = {};
      if (filterDto.fromDate) {
        where.occurredAt.gte = new Date(filterDto.fromDate);
      }
      if (filterDto.toDate) {
        where.occurredAt.lte = new Date(filterDto.toDate);
      }
    }

    if (filterDto.isSecurityEvent !== undefined) {
      where.isSecurityEvent = filterDto.isSecurityEvent;
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.occurredAt = 'desc';
    }

    // Execute queries
    const [activities, total] = await Promise.all([
      this.prismaService.activity.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prismaService.activity.count({ where }),
    ]);

    const activityResponses = activities.map((activity) =>
      this.mapToResponseDto(activity),
    );

    return new PaginatedResponseDto(
      activityResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  // Helper methods for common activity logging
  async logLogin(context: ActivityContext): Promise<void> {
    await this.createActivity(
      {
        type: ActivityType.LOGIN,
        title: 'User Login',
        description: 'User successfully logged in',
      },
      context,
    );
  }

  async logLogout(context: ActivityContext): Promise<void> {
    await this.createActivity(
      {
        type: ActivityType.LOGOUT,
        title: 'User Logout',
        description: 'User logged out',
      },
      context,
    );
  }

  async logPaymentInitiated(
    paymentId: string,
    amount: number,
    paymentMethod: string,
    context: ActivityContext,
  ): Promise<void> {
    await this.createActivity(
      {
        type: ActivityType.PAYMENT_INITIATED,
        title: 'Payment Initiated',
        description: `Payment of ${amount} initiated`,
        metadata: {
          paymentId,
          amount,
          paymentMethod,
        },
        relatedPaymentId: paymentId,
      },
      context,
    );
  }

  async logPaymentCompleted(
    paymentId: string,
    amount: number,
    context: ActivityContext,
  ): Promise<void> {
    await this.createActivity(
      {
        type: ActivityType.PAYMENT_COMPLETED,
        title: 'Payment Completed',
        description: `Payment of ${amount} completed successfully`,
        metadata: {
          paymentId,
          amount,
        },
        relatedPaymentId: paymentId,
      },
      context,
    );
  }

  async logPaymentFailed(
    paymentId: string,
    amount: number,
    reason: string,
    context: ActivityContext,
  ): Promise<void> {
    await this.createActivity(
      {
        type: ActivityType.PAYMENT_FAILED,
        title: 'Payment Failed',
        description: `Payment of ${amount} failed: ${reason}`,
        metadata: {
          paymentId,
          amount,
          reason,
        },
        relatedPaymentId: paymentId,
      },
      context,
    );
  }

  async logSecurityEvent(
    type: ActivityType,
    title: string,
    description: string,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    context: ActivityContext,
    metadata?: any,
  ): Promise<void> {
    await this.createActivity(
      {
        type,
        title,
        description,
        isSecurityEvent: true,
        riskLevel,
        metadata,
      },
      context,
    );
  }

  async logFailedLogin(
    phone: string,
    reason: string,
    context: Omit<ActivityContext, 'userId'>,
  ): Promise<void> {
    await this.createActivity(
      {
        type: ActivityType.FAILED_LOGIN_ATTEMPT,
        title: 'Failed Login Attempt',
        description: `Failed login attempt for ${phone}: ${reason}`,
        isSecurityEvent: true,
        riskLevel: 'MEDIUM',
        metadata: {
          phone,
          reason,
        },
      },
      { ...context, userId: 'system' }, // Use system as userId for failed attempts
    );
  }

  async logPinReset(
    context: ActivityContext,
    isRequested: boolean = true,
  ): Promise<void> {
    await this.createActivity(
      {
        type: isRequested
          ? ActivityType.PIN_RESET_REQUESTED
          : ActivityType.PIN_RESET_COMPLETED,
        title: isRequested ? 'PIN Reset Requested' : 'PIN Reset Completed',
        description: isRequested
          ? 'User requested PIN reset'
          : 'User completed PIN reset',
        isSecurityEvent: true,
        riskLevel: 'MEDIUM',
      },
      context,
    );
  }

  private mapToResponseDto(activity: any): ActivityResponseDto {
    return {
      id: activity.id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      userId: activity.userId,
      cooperativeId: activity.cooperativeId,
      metadata: activity.metadata,
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      relatedPaymentId: activity.relatedPaymentId,
      relatedComplaintId: activity.relatedComplaintId,
      isSecurityEvent: activity.isSecurityEvent,
      riskLevel: activity.riskLevel,
      occurredAt: activity.occurredAt,
      createdAt: activity.createdAt,
    };
  }
}
