import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateComplaintDto } from '../presentation/dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from '../presentation/dto/update-complaint-status.dto';
import { ComplaintFilterDto } from '../presentation/dto/complaint-filter.dto';
import { ComplaintResponseDto } from '../presentation/dto/complaint-response.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import {
  ComplaintStatus,
  ComplaintPriority,
  UserRole,
  NotificationType,
} from '@prisma/client';
import { ActivityService } from '../../activity/application/activity.service';
import { NotificationService } from '../../notification/application/notification.service';

export interface ComplaintContext {
  userId: string;
  cooperativeId: string;
  userRole: UserRole;
}

@Injectable()
export class ComplaintService {
  constructor(
    private prismaService: PrismaService,
    private activityService: ActivityService,
    private notificationService: NotificationService,
  ) {}

  async createComplaint(
    createComplaintDto: CreateComplaintDto,
    context: ComplaintContext,
  ): Promise<ComplaintResponseDto> {
    const targetCooperativeId =
      createComplaintDto.cooperativeId || context.cooperativeId;
    if (!targetCooperativeId) {
      throw new BadRequestException('cooperativeId is required');
    }

    // Validate cooperative access
    await this.validateCooperativeAccess(targetCooperativeId, context);

    // Create the complaint
    const complaint = await this.prismaService.complaint.create({
      data: {
        title: createComplaintDto.title,
        description: createComplaintDto.description,
        priority: createComplaintDto.priority || ComplaintPriority.MEDIUM,
        status: ComplaintStatus.OPEN,
        attachments: createComplaintDto.attachments,
        userId: context.userId,
        cooperativeId: targetCooperativeId,
      },
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
    });

    // Log activity
    await this.activityService.createActivity(
      {
        type: 'COMPLAINT_CREATED',
        title: 'Complaint Created',
        description: `New complaint: ${createComplaintDto.title}`,
        metadata: {
          complaintId: complaint.id,
          priority: complaint.priority,
          targetCooperativeId: targetCooperativeId,
        },
        relatedComplaintId: complaint.id,
      },
      {
        userId: context.userId,
        cooperativeId: targetCooperativeId,
      },
    );

    return this.mapToResponseDto(complaint);
  }

  private async validateCooperativeAccess(
    targetCooperativeId: string,
    context: ComplaintContext,
  ): Promise<void> {
    // Check if the cooperative exists
    const cooperative = await this.prismaService.cooperative.findUnique({
      where: { id: targetCooperativeId },
      select: { id: true, name: true, status: true },
    });

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    if (cooperative.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot create complaints for inactive cooperatives',
      );
    }

    // Role-based access validation
    if (context.userRole === UserRole.TENANT) {
      // Tenants can only create complaints for their own cooperative
      if (targetCooperativeId !== context.cooperativeId) {
        throw new ForbiddenException(
          'Tenants can only create complaints for their own cooperative',
        );
      }
    } else if (context.userRole === UserRole.ORGANIZATION_ADMIN) {
      // Organization admins can only create complaints for their own cooperative
      if (targetCooperativeId !== context.cooperativeId) {
        throw new ForbiddenException(
          'Organization admins can only create complaints for their own cooperative',
        );
      }
    }
    // Super admins can create complaints for any cooperative
  }

  async findAll(
    filterDto: ComplaintFilterDto,
    context: ComplaintContext,
  ): Promise<PaginatedResponseDto<ComplaintResponseDto>> {
    const { page, limit, skip, sortBy, sortOrder, search } = filterDto;

    // Build where clause based on user role
    const where: any = {};

    if (context.userRole === UserRole.SUPER_ADMIN) {
      // Super admins can see all complaints
      if (filterDto.userId) {
        where.userId = filterDto.userId;
      }
      if (context.cooperativeId && context.userRole !== UserRole.SUPER_ADMIN) {
        where.cooperativeId = context.cooperativeId;
      }
    } else if (context.userRole === UserRole.ORGANIZATION_ADMIN) {
      // Organization admins can see all complaints in their cooperative
      where.cooperativeId = context.cooperativeId;
      if (filterDto.userId) {
        where.userId = filterDto.userId;
      }
    } else {
      // Tenants can only see their own complaints
      where.userId = context.userId;
      where.cooperativeId = context.cooperativeId;
    }

    // Apply additional filters
    if (filterDto.status) {
      where.status = filterDto.status;
    }

    if (filterDto.priority) {
      where.priority = filterDto.priority;
    }

    if (filterDto.fromDate || filterDto.toDate) {
      where.createdAt = {};
      if (filterDto.fromDate) {
        where.createdAt.gte = new Date(filterDto.fromDate);
      }
      if (filterDto.toDate) {
        where.createdAt.lte = new Date(filterDto.toDate);
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { resolution: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    // Execute queries
    const [complaints, total] = await Promise.all([
      this.prismaService.complaint.findMany({
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
      this.prismaService.complaint.count({ where }),
    ]);

    const complaintResponses = complaints.map((complaint) =>
      this.mapToResponseDto(complaint),
    );

    return new PaginatedResponseDto(
      complaintResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async findById(
    id: string,
    context: ComplaintContext,
  ): Promise<ComplaintResponseDto> {
    const complaint = await this.prismaService.complaint.findUnique({
      where: { id },
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
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Check access permissions
    if (context.userRole === UserRole.TENANT) {
      // Tenants can only view their own complaints
      if (complaint.userId !== context.userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (context.userRole === UserRole.ORGANIZATION_ADMIN) {
      // Organization admins can view complaints in their cooperative
      if (complaint.cooperativeId !== context.cooperativeId) {
        throw new ForbiddenException('Access denied');
      }
    }
    // Super admins can view any complaint

    return this.mapToResponseDto(complaint);
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateComplaintStatusDto,
    context: ComplaintContext,
  ): Promise<ComplaintResponseDto> {
    // Only admins can update complaint status
    if (context.userRole === UserRole.TENANT) {
      throw new ForbiddenException(
        'Insufficient permissions to update complaint status',
      );
    }

    const existingComplaint = await this.prismaService.complaint.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (!existingComplaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Organization admins can only update complaints in their cooperative
    if (context.userRole === UserRole.ORGANIZATION_ADMIN) {
      if (existingComplaint.cooperativeId !== context.cooperativeId) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Prepare update data
    const updateData: any = {
      status: updateStatusDto.status,
      updatedAt: new Date(),
    };

    if (updateStatusDto.resolution) {
      updateData.resolution = updateStatusDto.resolution;
    }

    if (
      updateStatusDto.status === ComplaintStatus.RESOLVED ||
      updateStatusDto.status === ComplaintStatus.CLOSED
    ) {
      updateData.resolvedAt = new Date();
    }

    // Update the complaint
    const updatedComplaint = await this.prismaService.complaint.update({
      where: { id },
      data: updateData,
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
    });

    // Log activity
    await this.activityService.createActivity(
      {
        type: 'COMPLAINT_UPDATED',
        title: 'Complaint Status Updated',
        description: `Complaint "${existingComplaint.title}" status changed to ${updateStatusDto.status}`,
        metadata: {
          complaintId: id,
          oldStatus: existingComplaint.status,
          newStatus: updateStatusDto.status,
          resolution: updateStatusDto.resolution,
        },
        relatedComplaintId: id,
      },
      {
        userId: context.userId,
        cooperativeId: context.cooperativeId,
      },
    );

    // Send notifications when complaint is completed
    await this.sendComplaintCompletionNotification(
      updatedComplaint,
      existingComplaint.status,
      updateStatusDto.status,
    );

    return this.mapToResponseDto(updatedComplaint);
  }

  async getComplaintStats(
    context: ComplaintContext,
    filters?: {
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<any> {
    // Only admins can view complaint statistics
    if (context.userRole === UserRole.TENANT) {
      throw new ForbiddenException(
        'Insufficient permissions to view complaint statistics',
      );
    }

    const where: any = {};

    if (context.userRole === UserRole.ORGANIZATION_ADMIN) {
      where.cooperativeId = context.cooperativeId;
    }

    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.createdAt.lte = new Date(filters.toDate);
      }
    }

    // Get complaint statistics
    const [
      totalComplaints,
      statusBreakdown,
      priorityBreakdown,
      recentComplaints,
    ] = await Promise.all([
      // Total count
      this.prismaService.complaint.count({ where }),

      // Status breakdown
      this.prismaService.complaint.groupBy({
        by: ['status'],
        where,
        _count: {
          status: true,
        },
      }),

      // Priority breakdown
      this.prismaService.complaint.groupBy({
        by: ['priority'],
        where,
        _count: {
          priority: true,
        },
      }),

      // Recent complaints (last 10)
      this.prismaService.complaint.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    return {
      summary: {
        totalComplaints,
      },
      statusBreakdown: statusBreakdown.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      priorityBreakdown: priorityBreakdown.map((item) => ({
        priority: item.priority,
        count: item._count.priority,
      })),
      recentComplaints: recentComplaints.map((complaint) => ({
        id: complaint.id,
        title: complaint.title,
        status: complaint.status,
        priority: complaint.priority,
        user: `${complaint.user.firstName} ${complaint.user.lastName}`,
        userPhone: complaint.user.phone,
        createdAt: complaint.createdAt,
      })),
    };
  }

  /**
   * Send notifications when a complaint is completed (RESOLVED or CLOSED)
   */
  private async sendComplaintCompletionNotification(
    complaint: any,
    oldStatus: ComplaintStatus,
    newStatus: ComplaintStatus,
  ): Promise<void> {
    // Only send notifications when complaint is being completed
    const isCompleted =
      newStatus === ComplaintStatus.RESOLVED ||
      newStatus === ComplaintStatus.CLOSED;
    const wasNotCompleted =
      oldStatus !== ComplaintStatus.RESOLVED &&
      oldStatus !== ComplaintStatus.CLOSED;

    if (!isCompleted || !wasNotCompleted) {
      return; // Not a completion event
    }

    try {
      console.log(
        `🔔 Sending completion notifications for complaint ${complaint.id}`,
      );

      // Get the complaint user (who filed the complaint)
      const complaintUser = await this.prismaService.user.findUnique({
        where: { id: complaint.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          fcmToken: true,
        },
      });

      if (!complaintUser) {
        console.warn(`User not found for complaint ${complaint.id}`);
        return;
      }

      // Build notification content
      const { title, message } = this.buildCompletionNotificationContent(
        complaint,
        newStatus,
      );

      // Define notification types to send (both push and in-app)
      const notificationTypes: NotificationType[] = [
        NotificationType.IN_APP,
        NotificationType.PUSH_NOTIFICATION,
      ];

      // Add SMS if user has phone number
      if (complaintUser.phone) {
        notificationTypes.push(NotificationType.SMS);
      }

      // Send notifications
      await this.notificationService.sendComplaintNotification(
        complaint,
        complaintUser,
        notificationTypes,
        title,
        message,
      );

      console.log(
        `✅ Completion notifications sent successfully for complaint ${complaint.id}`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to send completion notifications for complaint ${complaint.id}:`,
        error.message,
      );
    }
  }

  /**
   * Build notification content for complaint completion
   */
  private buildCompletionNotificationContent(
    complaint: any,
    status: ComplaintStatus,
  ): { title: string; message: string } {
    const statusText = status === ComplaintStatus.RESOLVED ? 'resolved' : 'closed';
    const statusEmoji = status === ComplaintStatus.RESOLVED ? '✅' : '🔒';

    const title = `${statusEmoji} Complaint ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`;
    
    let message = `Your complaint "${complaint.title}" has been ${statusText}.`;

    // Add resolution if provided
    if (complaint.resolution && status === ComplaintStatus.RESOLVED) {
      message += `\\n\\nResolution: ${complaint.resolution}`;
    }

    // Add completion time
    if (complaint.resolvedAt) {
      const resolvedDate = new Date(complaint.resolvedAt).toLocaleDateString();
      message += `\\n\\nCompleted on: ${resolvedDate}`;
    }

    message += '\\n\\nThank you for your patience!';

    return { title, message };
  }

  private mapToResponseDto(complaint: any): ComplaintResponseDto {
    return {
      id: complaint.id,
      title: complaint.title,
      description: complaint.description,
      status: complaint.status,
      priority: complaint.priority,
      resolution: complaint.resolution,
      resolvedAt: complaint.resolvedAt,
      attachments: complaint.attachments,
      user: complaint.user,
      cooperative: complaint.cooperative,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
    };
  }
}
