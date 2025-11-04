import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/application/notification.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from '../presentation/dto/create-announcement.dto';
import {
  AnnouncementResponseDto,
  AnnouncementSummaryDto,
  AnnouncementStatsDto,
} from '../presentation/dto/announcement-response.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import {
  AnnouncementStatus,
  AnnouncementTargetType,
  UserRole,
  NotificationType,
  Prisma,
} from '@prisma/client';

@Injectable()
export class AnnouncementService {
  private readonly logger = new Logger(AnnouncementService.name);

  constructor(
    private prismaService: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async createAnnouncement(
    createAnnouncementDto: CreateAnnouncementDto,
    createdById: string,
    userRole: UserRole,
    userCooperativeId?: string,
  ): Promise<AnnouncementResponseDto> {
    this.logger.log(`Creating announcement: ${createAnnouncementDto.title}`);

    // Validate targeting permissions
    await this.validateTargetingPermissions(
      createAnnouncementDto,
      userRole,
      userCooperativeId,
    );

    // Validate notification types based on role
    this.validateNotificationTypes(
      createAnnouncementDto.notificationTypes,
      userRole,
    );

    // Calculate target recipients
    const targetUserIds = await this.calculateTargetRecipients(
      createAnnouncementDto.targetType,
      createAnnouncementDto.targetCooperativeIds,
      createAnnouncementDto.targetUserIds,
      userCooperativeId,
    );

    const scheduledAt = createAnnouncementDto.scheduledAt
      ? new Date(createAnnouncementDto.scheduledAt)
      : null;

    // Create announcement
    const announcement = await this.prismaService.announcement.create({
      data: {
        title: createAnnouncementDto.title,
        message: createAnnouncementDto.message,
        priority: createAnnouncementDto.priority,
        targetType: createAnnouncementDto.targetType,
        targetCooperativeIds: createAnnouncementDto.targetCooperativeIds || [],
        targetUserIds: createAnnouncementDto.targetUserIds || [],
        notificationTypes: createAnnouncementDto.notificationTypes,
        scheduledAt,
        createdById,
        cooperativeId: userCooperativeId,
        totalRecipients: targetUserIds.length,
        status: scheduledAt
          ? AnnouncementStatus.SCHEDULED
          : AnnouncementStatus.DRAFT,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
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

    // If not scheduled, send immediately
    if (!scheduledAt) {
      await this.sendAnnouncement(announcement.id);
    }

    return this.mapToAnnouncementResponse(announcement);
  }

  async sendAnnouncement(announcementId: string): Promise<void> {
    this.logger.log(`Sending announcement: ${announcementId}`);

    const announcement = await this.prismaService.announcement.findUnique({
      where: { id: announcementId },
      include: {
        createdBy: true,
        cooperative: true,
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    if (announcement.status === AnnouncementStatus.SENT) {
      this.logger.warn(`Announcement ${announcementId} already sent`);
      return;
    }

    // Update status to sending
    await this.prismaService.announcement.update({
      where: { id: announcementId },
      data: { status: AnnouncementStatus.SENDING },
    });

    try {
      // Get target recipients
      const targetUserIds = await this.calculateTargetRecipients(
        announcement.targetType,
        announcement.targetCooperativeIds,
        announcement.targetUserIds,
        announcement.cooperativeId || undefined,
      );
      let sentCount = 0;
      let failedCount = 0;

      // Send notifications to each recipient
      for (const userId of targetUserIds) {
        try {
          const user = await this.prismaService.user.findUnique({
            where: { id: userId },
          });

          if (!user) {
            this.logger.warn(`User ${userId} not found for announcement`);
            failedCount++;
            continue;
          }

          // Filter notification types based on user role
          const allowedNotificationTypes = this.filterNotificationTypesByRole(
            announcement.notificationTypes,
            user.role,
          );

          // Send notifications for each allowed type
          for (const notificationType of allowedNotificationTypes) {
            try {
              await this.notificationService.sendAnnouncementNotification(
                notificationType,
                {
                  title: announcement.title,
                  message: announcement.message,
                },
                user,
                {
                  userId: user.id,
                  cooperativeId: user.cooperativeId || undefined,
                  announcementId: announcement.id,
                },
              );
            } catch (error) {
              this.logger.error(
                `Failed to send ${notificationType} notification to user ${userId}:`,
                error.message,
              );
              // Continue with other notification types
            }
          }

          sentCount++;
        } catch (error) {
          this.logger.error(
            `Failed to send announcement to user ${userId}:`,
            error.message,
          );
          failedCount++;
        }
      }

      // Update announcement status and statistics
      await this.prismaService.announcement.update({
        where: { id: announcementId },
        data: {
          status: AnnouncementStatus.SENT,
          sentAt: new Date(),
          sentCount,
          failedCount,
          deliveredCount: sentCount, // Will be updated by notification service
        },
      });

      this.logger.log(
        `Announcement ${announcementId} sent successfully. Sent: ${sentCount}, Failed: ${failedCount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send announcement ${announcementId}:`,
        error.message,
      );

      // Update status to failed (we can add this status to the enum if needed)
      await this.prismaService.announcement.update({
        where: { id: announcementId },
        data: { status: AnnouncementStatus.DRAFT }, // Revert to draft for retry
      });

      throw error;
    }
  }

  async getAnnouncements(
    paginationDto: PaginationDto,
    userRole: UserRole,
    userCooperativeId?: string,
    status?: AnnouncementStatus,
  ): Promise<PaginatedResponseDto<AnnouncementSummaryDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = paginationDto;
    const skip = (page - 1) * limit;

    // Build where clause based on user role
    const whereClause: Prisma.AnnouncementWhereInput = {};

    if (userRole === UserRole.ORGANIZATION_ADMIN && userCooperativeId) {
      whereClause.cooperativeId = userCooperativeId;
    } else if (userRole === UserRole.TENANT) {
      throw new ForbiddenException('Tenants cannot view announcements list');
    }

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [announcements, total] = await Promise.all([
      this.prismaService.announcement.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [sortBy as string]: sortOrder },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          targetType: true,
          totalRecipients: true,
          sentCount: true,
          scheduledAt: true,
          createdAt: true,
        },
      }),
      this.prismaService.announcement.count({ where: whereClause }),
    ]);

    const data = announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      status: announcement.status,
      priority: announcement.priority,
      targetType: announcement.targetType,
      totalRecipients: announcement.totalRecipients,
      sentCount: announcement.sentCount,
      scheduledAt: announcement.scheduledAt
        ? announcement.scheduledAt
        : undefined,
      createdAt: announcement.createdAt,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async getAnnouncementById(
    id: string,
    userRole: UserRole,
    userCooperativeId?: string,
  ): Promise<AnnouncementResponseDto> {
    const announcement = await this.prismaService.announcement.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
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

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    // Check access permissions
    if (
      userRole === UserRole.ORGANIZATION_ADMIN &&
      announcement.cooperativeId !== userCooperativeId
    ) {
      throw new ForbiddenException('Access denied to this announcement');
    }

    if (userRole === UserRole.TENANT) {
      throw new ForbiddenException('Tenants cannot view announcement details');
    }

    return this.mapToAnnouncementResponse(announcement);
  }

  async updateAnnouncement(
    id: string,
    updateAnnouncementDto: UpdateAnnouncementDto,
    userRole: UserRole,
    userCooperativeId?: string,
  ): Promise<AnnouncementResponseDto> {
    const announcement = await this.prismaService.announcement.findUnique({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    // Check access permissions
    if (
      userRole === UserRole.ORGANIZATION_ADMIN &&
      announcement.cooperativeId !== userCooperativeId
    ) {
      throw new ForbiddenException('Access denied to this announcement');
    }

    if (userRole === UserRole.TENANT) {
      throw new ForbiddenException('Tenants cannot update announcements');
    }

    // Cannot update sent announcements
    if (announcement.status === AnnouncementStatus.SENT) {
      throw new BadRequestException('Cannot update sent announcements');
    }

    const updatedAnnouncement = await this.prismaService.announcement.update({
      where: { id },
      data: {
        ...updateAnnouncementDto,
        scheduledAt: updateAnnouncementDto.scheduledAt
          ? new Date(updateAnnouncementDto.scheduledAt)
          : undefined,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
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

    return this.mapToAnnouncementResponse(updatedAnnouncement);
  }

  async deleteAnnouncement(
    id: string,
    userRole: UserRole,
    userCooperativeId?: string,
  ): Promise<void> {
    const announcement = await this.prismaService.announcement.findUnique({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    // Check access permissions
    if (
      userRole === UserRole.ORGANIZATION_ADMIN &&
      announcement.cooperativeId !== userCooperativeId
    ) {
      throw new ForbiddenException('Access denied to this announcement');
    }

    if (userRole === UserRole.TENANT) {
      throw new ForbiddenException('Tenants cannot delete announcements');
    }

    // Cannot delete sent announcements
    if (announcement.status === AnnouncementStatus.SENT) {
      throw new BadRequestException('Cannot delete sent announcements');
    }

    await this.prismaService.announcement.delete({
      where: { id },
    });
  }

  async getAnnouncementStats(
    userRole: UserRole,
    userCooperativeId?: string,
  ): Promise<AnnouncementStatsDto> {
    const whereClause: Prisma.AnnouncementWhereInput = {};

    if (userRole === UserRole.ORGANIZATION_ADMIN && userCooperativeId) {
      whereClause.cooperativeId = userCooperativeId;
    } else if (userRole === UserRole.TENANT) {
      throw new ForbiddenException(
        'Tenants cannot view announcement statistics',
      );
    }

    const [total, statusBreakdown, targetTypeBreakdown, recentAnnouncements] =
      await Promise.all([
        this.prismaService.announcement.count({ where: whereClause }),
        this.prismaService.announcement.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { _all: true },
        }),
        this.prismaService.announcement.groupBy({
          by: ['targetType'],
          where: whereClause,
          _count: { _all: true },
        }),
        this.prismaService.announcement.findMany({
          where: whereClause,
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            targetType: true,
            totalRecipients: true,
            sentCount: true,
            scheduledAt: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      total,
      statusBreakdown: statusBreakdown.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      targetTypeBreakdown: targetTypeBreakdown.map((item) => ({
        targetType: item.targetType,
        count: item._count._all,
      })),
      recentAnnouncements: recentAnnouncements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        status: announcement.status,
        priority: announcement.priority,
        targetType: announcement.targetType,
        totalRecipients: announcement.totalRecipients,
        sentCount: announcement.sentCount,
        scheduledAt: announcement.scheduledAt
          ? announcement.scheduledAt
          : undefined,
        createdAt: announcement.createdAt,
      })),
    };
  }

  // Private helper methods

  private async validateTargetingPermissions(
    createAnnouncementDto: CreateAnnouncementDto,
    userRole: UserRole,
    userCooperativeId?: string,
  ): Promise<void> {
    const { targetType, targetCooperativeIds, targetUserIds } =
      createAnnouncementDto;

    if (userRole === UserRole.TENANT) {
      throw new ForbiddenException('Tenants cannot create announcements');
    }

    if (userRole === UserRole.ORGANIZATION_ADMIN) {
      // Organization admins can only target their own cooperative
      if (targetType === AnnouncementTargetType.ALL_TENANTS) {
        // This will target all tenants in the org admin's cooperative
        return;
      }

      if (targetType === AnnouncementTargetType.ALL_ORGANIZATION_ADMINS) {
        throw new ForbiddenException(
          'Organization admins cannot target other organization admins',
        );
      }

      if (targetType === AnnouncementTargetType.SPECIFIC_COOPERATIVE) {
        if (
          !targetCooperativeIds ||
          targetCooperativeIds.length !== 1 ||
          targetCooperativeIds[0] !== userCooperativeId
        ) {
          throw new ForbiddenException(
            'Organization admins can only target their own cooperative',
          );
        }
      }

      if (targetType === AnnouncementTargetType.SPECIFIC_USERS) {
        // Validate that all target users belong to the org admin's cooperative
        if (!targetUserIds || targetUserIds.length === 0) {
          throw new BadRequestException(
            'User IDs are required for SPECIFIC_USERS targeting',
          );
        }

        const users = await this.prismaService.user.findMany({
          where: {
            id: { in: targetUserIds },
            cooperativeId: userCooperativeId,
          },
        });

        if (users.length !== targetUserIds.length) {
          throw new ForbiddenException(
            'Some target users do not belong to your cooperative',
          );
        }
      }
    }

    // Super admins can target anyone
  }

  private validateNotificationTypes(
    notificationTypes: NotificationType[],
    userRole: UserRole,
  ): void {
    if (userRole === UserRole.ORGANIZATION_ADMIN) {
      // Organization admins can only use IN_APP and SMS
      const allowedTypes: NotificationType[] = [
        NotificationType.IN_APP,
        NotificationType.SMS,
      ];
      const hasInvalidType = notificationTypes.some(
        (type) => !allowedTypes.includes(type),
      );

      if (hasInvalidType) {
        throw new BadRequestException(
          'Organization admins can only use IN_APP and SMS notifications',
        );
      }
    }

    // Super admins can use all notification types
    // Tenants cannot create announcements (handled in validateTargetingPermissions)
  }

  private filterNotificationTypesByRole(
    notificationTypes: NotificationType[],
    userRole: UserRole,
  ): NotificationType[] {
    if (userRole === UserRole.TENANT) {
      // Tenants can receive IN_APP, PUSH, and SMS
      const allowedTypes: NotificationType[] = [
        NotificationType.IN_APP,
        NotificationType.PUSH_NOTIFICATION,
        NotificationType.SMS,
      ];
      return notificationTypes.filter((type) => allowedTypes.includes(type));
    } else if (userRole === UserRole.ORGANIZATION_ADMIN) {
      // Organization admins can receive IN_APP and SMS
      const allowedTypes: NotificationType[] = [
        NotificationType.IN_APP,
        NotificationType.SMS,
      ];
      return notificationTypes.filter((type) => allowedTypes.includes(type));
    }

    // Super admins can receive all types
    return notificationTypes;
  }

  private async calculateTargetRecipients(
    targetType: AnnouncementTargetType,
    targetCooperativeIds?: string[],
    targetUserIds?: string[],
    userCooperativeId?: string,
  ): Promise<string[]> {
    switch (targetType) {
      case AnnouncementTargetType.ALL_TENANTS:
        const whereClause: Prisma.UserWhereInput = { role: UserRole.TENANT };
        if (userCooperativeId) {
          whereClause.cooperativeId = userCooperativeId;
        }

        const tenants = await this.prismaService.user.findMany({
          where: whereClause,
          select: { id: true },
        });
        return tenants.map((user) => user.id);

      case AnnouncementTargetType.ALL_ORGANIZATION_ADMINS:
        const orgAdmins = await this.prismaService.user.findMany({
          where: { role: UserRole.ORGANIZATION_ADMIN },
          select: { id: true },
        });
        return orgAdmins.map((user) => user.id);

      case AnnouncementTargetType.SPECIFIC_COOPERATIVE:
        if (!targetCooperativeIds || targetCooperativeIds.length === 0) {
          throw new BadRequestException(
            'Cooperative IDs are required for SPECIFIC_COOPERATIVE targeting',
          );
        }

        const cooperativeUsers = await this.prismaService.user.findMany({
          where: { cooperativeId: { in: targetCooperativeIds } },
          select: { id: true },
        });
        return cooperativeUsers.map((user) => user.id);

      case AnnouncementTargetType.SPECIFIC_USERS:
        if (!targetUserIds || targetUserIds.length === 0) {
          throw new BadRequestException(
            'User IDs are required for SPECIFIC_USERS targeting',
          );
        }
        return targetUserIds;

      default:
        throw new BadRequestException('Invalid target type');
    }
  }

  private mapToAnnouncementResponse(
    announcement: any,
  ): AnnouncementResponseDto {
    return {
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      priority: announcement.priority,
      status: announcement.status,
      targetType: announcement.targetType,
      targetCooperativeIds: announcement.targetCooperativeIds,
      targetUserIds: announcement.targetUserIds,
      notificationTypes: announcement.notificationTypes,
      scheduledAt: announcement.scheduledAt,
      sentAt: announcement.sentAt,
      createdBy: {
        id: announcement.createdBy.id,
        firstName: announcement.createdBy.firstName || '',
        lastName: announcement.createdBy.lastName || '',
        role: announcement.createdBy.role,
      },
      cooperative: announcement.cooperative
        ? {
            id: announcement.cooperative.id,
            name: announcement.cooperative.name,
            code: announcement.cooperative.code,
          }
        : undefined,
      statistics: {
        total: announcement.totalRecipients,
        sent: announcement.sentCount,
        delivered: announcement.deliveredCount,
        failed: announcement.failedCount,
      },
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    };
  }
}
