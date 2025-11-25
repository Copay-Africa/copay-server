import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AnalyticsQueryDto,
  DashboardStatsDto,
  PaymentAnalyticsDto,
  UserAnalyticsDto,
  CooperativeAnalyticsDto,
  ActivityAnalyticsDto,
  RevenueAnalyticsDto,
  TimePeriod,
} from '../presentation/dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard statistics overview
   */
  async getDashboardStats(
    query: AnalyticsQueryDto,
  ): Promise<DashboardStatsDto> {
    try {
      const dateRange = this.getDateRange(query);
      const previousPeriodRange = this.getPreviousPeriodRange(dateRange);

      // Current period stats
      const [
        totalUsers,
        totalCooperatives,
        totalPayments,
        totalPaymentAmount,
        pendingAccountRequests,
        activeReminders,
        openComplaints,
      ] = await Promise.all([
        this.prisma.user.count({ where: { status: 'ACTIVE' } }),
        this.prisma.cooperative.count({ where: { status: 'ACTIVE' } }),
        this.prisma.payment.count({
          where: {
            createdAt: dateRange,
            status: 'COMPLETED',
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            createdAt: dateRange,
            status: 'COMPLETED',
          },
          _sum: { amount: true },
        }),
        this.prisma.accountRequest.count({
          where: { status: 'PENDING' },
        }),
        this.prisma.reminder.count({
          where: { status: 'ACTIVE' },
        }),
        this.prisma.complaint.count({
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        }),
      ]);

      // Previous period stats for growth calculation
      const [prevUsers, prevPayments, prevPaymentAmount] = await Promise.all([
        this.prisma.user.count({
          where: {
            status: 'ACTIVE',
            createdAt: previousPeriodRange,
          },
        }),
        this.prisma.payment.count({
          where: {
            createdAt: previousPeriodRange,
            status: 'COMPLETED',
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            createdAt: previousPeriodRange,
            status: 'COMPLETED',
          },
          _sum: { amount: true },
        }),
      ]);

      // Calculate growth percentages
      const growthPercentage = {
        users: this.calculateGrowthRate(totalUsers, prevUsers),
        payments: this.calculateGrowthRate(totalPayments, prevPayments),
        revenue: this.calculateGrowthRate(
          totalPaymentAmount._sum.amount || 0,
          prevPaymentAmount._sum.amount || 0,
        ),
      };

      return {
        totalUsers,
        totalCooperatives,
        totalPayments,
        totalPaymentAmount: totalPaymentAmount._sum.amount || 0,
        pendingAccountRequests,
        activeReminders,
        openComplaints,
        growthPercentage,
      };
    } catch (error) {
      this.logger.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics(
    query: AnalyticsQueryDto,
  ): Promise<PaymentAnalyticsDto> {
    try {
      const dateRange = this.getDateRange(query);
      const whereClause = {
        createdAt: dateRange,
        ...(query.cooperativeId && { cooperativeId: query.cooperativeId }),
      };

      // Basic payment stats
      const [
        paymentStats,
        paymentSum,
        successfulPayments,
        paymentMethods,
        paymentStatuses,
      ] = await Promise.all([
        this.prisma.payment.count({ where: whereClause }),
        this.prisma.payment.aggregate({
          where: whereClause,
          _sum: { amount: true },
          _avg: { amount: true },
        }),
        this.prisma.payment.count({
          where: { ...whereClause, status: 'COMPLETED' },
        }),
        this.prisma.payment.groupBy({
          by: ['paymentMethod'],
          where: whereClause,
          _count: true,
        }),
        this.prisma.payment.groupBy({
          by: ['status'],
          where: whereClause,
          _count: true,
        }),
      ]);

      // Payment trends (daily aggregation)
      const trends = await this.getPaymentTrends(whereClause);

      const totalVolume = paymentStats;
      const totalAmount = paymentSum._sum.amount || 0;
      const averageAmount = paymentSum._avg.amount || 0;
      const successRate =
        totalVolume > 0 ? (successfulPayments / totalVolume) * 100 : 0;

      // Most popular payment method
      const mostPopularMethod =
        paymentMethods.reduce((prev, current) =>
          prev._count > current._count ? prev : current,
        )?.paymentMethod || 'N/A';

      // Status distribution
      const statusDistribution = paymentStatuses.map((status) => ({
        status: status.status,
        count: status._count,
        percentage: totalVolume > 0 ? (status._count / totalVolume) * 100 : 0,
      }));

      // Method distribution
      const methodDistribution = paymentMethods.map((method) => ({
        method: method.paymentMethod || 'Unknown',
        count: method._count,
        percentage: totalVolume > 0 ? (method._count / totalVolume) * 100 : 0,
      }));

      return {
        totalVolume,
        totalAmount,
        averageAmount,
        successRate,
        mostPopularMethod: String(mostPopularMethod),
        trends,
        statusDistribution,
        methodDistribution,
      };
    } catch (error) {
      this.logger.error('Error fetching payment analytics:', error);
      throw error;
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(query: AnalyticsQueryDto): Promise<UserAnalyticsDto> {
    try {
      const dateRange = this.getDateRange(query);

      const [
        totalUsers,
        activeUsers,
        newRegistrations,
        roleDistribution,
        statusDistribution,
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.activity.findMany({
          where: {
            createdAt: dateRange,
            type: { in: ['LOGIN', 'PAYMENT_COMPLETED', 'PROFILE_UPDATED'] },
          },
          select: { userId: true },
          distinct: ['userId'],
        }),
        this.prisma.user.count({
          where: { createdAt: dateRange },
        }),
        this.prisma.user.groupBy({
          by: ['role'],
          _count: true,
        }),
        this.prisma.user.groupBy({
          by: ['status'],
          _count: true,
        }),
      ]);

      const activeUserCount = activeUsers.length;
      const activityTrends = await this.getUserActivityTrends(dateRange);

      // Calculate growth rate
      const previousPeriodRange = this.getPreviousPeriodRange(dateRange);
      const prevNewUsers = await this.prisma.user.count({
        where: { createdAt: previousPeriodRange },
      });
      const growthRate = this.calculateGrowthRate(
        newRegistrations,
        prevNewUsers,
      );

      return {
        totalUsers,
        activeUsers: activeUserCount,
        newRegistrations,
        growthRate,
        activityTrends,
        roleDistribution: roleDistribution.map((role) => ({
          role: role.role,
          count: role._count,
          percentage: totalUsers > 0 ? (role._count / totalUsers) * 100 : 0,
        })),
        statusDistribution: statusDistribution.map((status) => ({
          status: status.status,
          count: status._count,
          percentage: totalUsers > 0 ? (status._count / totalUsers) * 100 : 0,
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching user analytics:', error);
      throw error;
    }
  }

  /**
   * Get cooperative analytics
   */
  async getCooperativeAnalytics(
    query: AnalyticsQueryDto,
  ): Promise<CooperativeAnalyticsDto> {
    try {
      const dateRange = this.getDateRange(query);

      const [
        totalCooperatives,
        activeCooperatives,
        topPerforming,
        paymentFrequencies,
      ] = await Promise.all([
        this.prisma.cooperative.count(),
        this.prisma.cooperative.count({ where: { status: 'ACTIVE' } }),
        this.getTopPerformingCooperatives(5),
        this.prisma.cooperative.groupBy({
          by: ['paymentFrequency'],
          _count: true,
        }),
      ]);

      const growthTrends = await this.getCooperativeGrowthTrends(dateRange);

      // Calculate average members by counting user relationships
      const memberCounts = await this.prisma.userCooperativeRoom.groupBy({
        by: ['cooperativeId'],
        _count: {
          userId: true,
        },
      });

      const averageMembers =
        memberCounts.length > 0
          ? memberCounts.reduce((sum, item) => sum + item._count.userId, 0) /
            memberCounts.length
          : 0;

      return {
        totalCooperatives,
        activeCooperatives,
        averageMembers,
        topPerforming,
        growthTrends,
        paymentFrequencyDistribution: paymentFrequencies.map((freq) => ({
          frequency: freq.paymentFrequency,
          count: freq._count,
          percentage:
            totalCooperatives > 0 ? (freq._count / totalCooperatives) * 100 : 0,
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching cooperative analytics:', error);
      throw error;
    }
  }

  /**
   * Get activity analytics
   */
  async getActivityAnalytics(
    query: AnalyticsQueryDto,
  ): Promise<ActivityAnalyticsDto> {
    try {
      const dateRange = this.getDateRange(query);
      const whereClause = { createdAt: dateRange };

      const [totalActivities, activityTypes, securityEvents, failedLogins] =
        await Promise.all([
          this.prisma.activity.count({ where: whereClause }),
          this.prisma.activity.groupBy({
            by: ['type'],
            where: whereClause,
            _count: true,
            orderBy: { _count: { type: 'desc' } },
            take: 10,
          }),
          this.prisma.activity.count({
            where: {
              ...whereClause,
              type: {
                in: [
                  'SECURITY_ALERT',
                  'FAILED_LOGIN_ATTEMPT',
                  'ACCOUNT_SUSPENDED',
                ],
              },
            },
          }),
          this.prisma.activity.count({
            where: {
              ...whereClause,
              type: 'FAILED_LOGIN_ATTEMPT',
            },
          }),
        ]);

      const activityTrends = await this.getActivityTrends(whereClause);
      const peakHours = await this.getActivityPeakHours(whereClause);

      return {
        totalActivities,
        topActivityTypes: activityTypes.map((type) => ({
          type: type.type,
          count: type._count,
          percentage:
            totalActivities > 0 ? (type._count / totalActivities) * 100 : 0,
        })),
        securityEvents,
        failedLogins,
        activityTrends,
        peakHours,
      };
    } catch (error) {
      this.logger.error('Error fetching activity analytics:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(
    query: AnalyticsQueryDto,
  ): Promise<RevenueAnalyticsDto> {
    try {
      const dateRange = this.getDateRange(query);
      const whereClause = {
        createdAt: dateRange,
        status: 'COMPLETED' as const,
        ...(query.cooperativeId && { cooperativeId: query.cooperativeId }),
      };

      const [
        revenueSum,
        userCount,
        cooperativeCount,
        revenueTrends,
        revenueByCooperative,
        revenueByMethod,
      ] = await Promise.all([
        this.prisma.payment.aggregate({
          where: whereClause,
          _sum: { amount: true },
        }),
        this.prisma.user.count({ where: { status: 'ACTIVE' } }),
        this.prisma.cooperative.count({ where: { status: 'ACTIVE' } }),
        this.getRevenueTrends(whereClause),
        this.getRevenueByCooperative(whereClause),
        this.getRevenueByPaymentMethod(whereClause),
      ]);

      const totalRevenue = revenueSum._sum?.amount || 0;

      // Calculate growth
      const previousPeriodRange = this.getPreviousPeriodRange(dateRange);
      const prevRevenue = await this.prisma.payment.aggregate({
        where: {
          createdAt: previousPeriodRange,
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      });

      const growthPercentage = this.calculateGrowthRate(
        totalRevenue,
        prevRevenue._sum?.amount || 0,
      );

      return {
        totalRevenue,
        growthPercentage,
        averageRevenuePerUser: userCount > 0 ? totalRevenue / userCount : 0,
        averageRevenuePerCooperative:
          cooperativeCount > 0 ? totalRevenue / cooperativeCount : 0,
        revenueTrends,
        revenueByCooperative,
        revenueByMethod,
      };
    } catch (error) {
      this.logger.error('Error fetching revenue analytics:', error);
      throw error;
    }
  }

  // Helper methods

  private getDateRange(query: AnalyticsQueryDto) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (query.period) {
      case TimePeriod.LAST_7_DAYS:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.LAST_30_DAYS:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.LAST_90_DAYS:
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.LAST_YEAR:
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.CUSTOM:
        startDate = query.startDate
          ? new Date(query.startDate)
          : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = query.endDate ? new Date(query.endDate) : now;
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { gte: startDate, lte: endDate };
  }

  private getPreviousPeriodRange(currentRange: { gte: Date; lte: Date }) {
    const periodLength =
      currentRange.lte.getTime() - currentRange.gte.getTime();
    return {
      gte: new Date(currentRange.gte.getTime() - periodLength),
      lte: new Date(currentRange.lte.getTime() - periodLength),
    };
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private async getPaymentTrends(whereClause: any) {
    const payments = await this.prisma.payment.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        amount: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const trendsMap = new Map();
    payments.forEach((payment) => {
      const date = payment.createdAt.toISOString().split('T')[0];
      if (!trendsMap.has(date)) {
        trendsMap.set(date, { volume: 0, amount: 0 });
      }
      const trend = trendsMap.get(date);
      trend.volume += 1;
      trend.amount += payment.amount;
    });

    return Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      volume: data.volume,
      amount: data.amount,
    }));
  }

  private async getUserActivityTrends(dateRange: any) {
    const activities = await this.prisma.activity.findMany({
      where: {
        createdAt: dateRange,
        type: { in: ['LOGIN', 'PROFILE_UPDATED'] },
      },
      select: {
        createdAt: true,
        type: true,
        userId: true,
      },
    });

    const trendsMap = new Map();
    activities.forEach((activity) => {
      const date = activity.createdAt.toISOString().split('T')[0];
      if (!trendsMap.has(date)) {
        trendsMap.set(date, { activeUsers: new Set(), newUsers: 0 });
      }
      const trend = trendsMap.get(date);
      if (activity.type === 'LOGIN') {
        trend.activeUsers.add(activity.userId);
      }
    });

    return Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      activeUsers: data.activeUsers.size,
      newUsers: data.newUsers,
    }));
  }

  private async getTopPerformingCooperatives(limit: number) {
    const cooperatives = await this.prisma.cooperative.findMany({
      take: limit,
      include: {
        _count: {
          select: { payments: true },
        },
        payments: {
          where: { status: 'COMPLETED' },
          select: { amount: true },
        },
        userCooperativeRooms: {
          select: { userId: true },
        },
      },
      orderBy: {
        payments: { _count: 'desc' },
      },
    });

    return cooperatives.map((coop) => ({
      id: coop.id,
      name: coop.name,
      memberCount: coop.userCooperativeRooms.length,
      totalPayments: coop._count.payments,
      totalRevenue: coop.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      ),
    }));
  }

  private async getCooperativeGrowthTrends(dateRange: any) {
    const cooperatives = await this.prisma.cooperative.findMany({
      where: { createdAt: dateRange },
      select: {
        createdAt: true,
        userCooperativeRooms: {
          select: { userId: true },
        },
      },
    });

    const trendsMap = new Map();
    cooperatives.forEach((coop) => {
      const date = coop.createdAt.toISOString().split('T')[0];
      if (!trendsMap.has(date)) {
        trendsMap.set(date, { newCooperatives: 0, totalMembers: 0 });
      }
      const trend = trendsMap.get(date);
      trend.newCooperatives += 1;
      trend.totalMembers += coop.userCooperativeRooms.length;
    });

    return Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      newCooperatives: data.newCooperatives,
      totalMembers: data.totalMembers,
    }));
  }

  private async getActivityTrends(whereClause: any) {
    const activities = await this.prisma.activity.findMany({
      where: whereClause,
      select: { createdAt: true, type: true },
    });

    const trendsMap = new Map();
    activities.forEach((activity) => {
      const date = activity.createdAt.toISOString().split('T')[0];
      if (!trendsMap.has(date)) {
        trendsMap.set(date, { totalActivities: 0, securityEvents: 0 });
      }
      const trend = trendsMap.get(date);
      trend.totalActivities += 1;
      if (
        [
          'SECURITY_ALERT',
          'FAILED_LOGIN_ATTEMPT',
          'ACCOUNT_SUSPENDED',
        ].includes(activity.type)
      ) {
        trend.securityEvents += 1;
      }
    });

    return Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      totalActivities: data.totalActivities,
      securityEvents: data.securityEvents,
    }));
  }

  private async getActivityPeakHours(whereClause: any) {
    const activities = await this.prisma.activity.findMany({
      where: whereClause,
      select: { createdAt: true },
    });

    const hourCounts = new Array(24).fill(0);
    activities.forEach((activity) => {
      const hour = activity.createdAt.getHours();
      hourCounts[hour] += 1;
    });

    return hourCounts.map((count, hour) => ({ hour, count }));
  }

  private async getRevenueTrends(whereClause: any) {
    const payments = await this.prisma.payment.findMany({
      where: whereClause,
      select: { createdAt: true, amount: true },
    });

    const trendsMap = new Map();
    payments.forEach((payment) => {
      const date = payment.createdAt.toISOString().split('T')[0];
      if (!trendsMap.has(date)) {
        trendsMap.set(date, { revenue: 0, transactionCount: 0 });
      }
      const trend = trendsMap.get(date);
      trend.revenue += payment.amount;
      trend.transactionCount += 1;
    });

    return Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      transactionCount: data.transactionCount,
    }));
  }

  private async getRevenueByCooperative(whereClause: any) {
    const revenueData = await this.prisma.payment.groupBy({
      by: ['cooperativeId'],
      where: whereClause,
      _sum: { amount: true },
    });

    const totalRevenue = revenueData.reduce(
      (sum, item) => sum + (item._sum.amount || 0),
      0,
    );

    const cooperativeIds = revenueData.map((item) => item.cooperativeId);
    const cooperatives = await this.prisma.cooperative.findMany({
      where: { id: { in: cooperativeIds } },
      select: { id: true, name: true },
    });

    return revenueData.map((item) => {
      const cooperative = cooperatives.find((c) => c.id === item.cooperativeId);
      const revenue = item._sum.amount || 0;
      return {
        cooperativeId: item.cooperativeId,
        cooperativeName: cooperative?.name || 'Unknown',
        revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      };
    });
  }

  private async getRevenueByPaymentMethod(whereClause: any) {
    const revenueData = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: whereClause,
      _sum: { amount: true },
    });

    const totalRevenue = revenueData.reduce(
      (sum, item) => sum + (item._sum.amount || 0),
      0,
    );

    return revenueData.map((item) => {
      const revenue = item._sum.amount || 0;
      return {
        method: item.paymentMethod || 'Unknown',
        revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      };
    });
  }
}
