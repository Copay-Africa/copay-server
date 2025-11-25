import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AnalyticsService } from '../application/analytics.service';
import {
  AnalyticsQueryDto,
  DashboardStatsDto,
  PaymentAnalyticsDto,
  UserAnalyticsDto,
  CooperativeAnalyticsDto,
  ActivityAnalyticsDto,
  RevenueAnalyticsDto,
  TimePeriod,
} from './dto/analytics.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description:
      'Retrieve comprehensive dashboard statistics including user counts, payment volumes, and growth metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard statistics retrieved successfully',
    type: DashboardStatsDto,
  })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period for analytics (default: last_30_days)',
  })
  @ApiQuery({
    name: 'startDate',
    type: String,
    required: false,
    description: 'Start date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'endDate',
    type: String,
    required: false,
    description: 'End date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'cooperativeId',
    type: String,
    required: false,
    description: 'Filter by specific cooperative',
  })
  async getDashboardStats(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: any,
  ): Promise<DashboardStatsDto> {
    try {
      this.logger.log(`Getting dashboard stats for user ${user.id}`);

      // If user is not SUPER_ADMIN, filter by their cooperative
      if (user.role === 'ORGANIZATION_ADMIN' && !query.cooperativeId) {
        query.cooperativeId = user.cooperativeId;
      }

      return await this.analyticsService.getDashboardStats(query);
    } catch (error) {
      this.logger.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  @Get('payments')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'TREASURER')
  @ApiOperation({
    summary: 'Get payment analytics',
    description:
      'Retrieve detailed payment analytics including volume, success rates, and trends',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment analytics retrieved successfully',
    type: PaymentAnalyticsDto,
  })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period for analytics (default: last_30_days)',
  })
  @ApiQuery({
    name: 'startDate',
    type: String,
    required: false,
    description: 'Start date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'endDate',
    type: String,
    required: false,
    description: 'End date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'cooperativeId',
    type: String,
    required: false,
    description: 'Filter by specific cooperative',
  })
  async getPaymentAnalytics(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: any,
  ): Promise<PaymentAnalyticsDto> {
    try {
      this.logger.log(`Getting payment analytics for user ${user.id}`);

      // If user is not SUPER_ADMIN, filter by their cooperative
      if (user.role !== 'SUPER_ADMIN' && !query.cooperativeId) {
        query.cooperativeId = user.cooperativeId;
      }

      return await this.analyticsService.getPaymentAnalytics(query);
    } catch (error) {
      this.logger.error('Error fetching payment analytics:', error);
      throw error;
    }
  }

  @Get('users')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get user analytics',
    description:
      'Retrieve user analytics including registrations, activity, and growth metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User analytics retrieved successfully',
    type: UserAnalyticsDto,
  })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period for analytics (default: last_30_days)',
  })
  @ApiQuery({
    name: 'startDate',
    type: String,
    required: false,
    description: 'Start date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'endDate',
    type: String,
    required: false,
    description: 'End date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'cooperativeId',
    type: String,
    required: false,
    description: 'Filter by specific cooperative',
  })
  async getUserAnalytics(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: any,
  ): Promise<UserAnalyticsDto> {
    try {
      this.logger.log(`Getting user analytics for user ${user.id}`);

      // If user is not SUPER_ADMIN, filter by their cooperative
      if (user.role === 'ORGANIZATION_ADMIN' && !query.cooperativeId) {
        query.cooperativeId = user.cooperativeId;
      }

      return await this.analyticsService.getUserAnalytics(query);
    } catch (error) {
      this.logger.error('Error fetching user analytics:', error);
      throw error;
    }
  }

  @Get('cooperatives')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get cooperative analytics',
    description:
      'Retrieve cooperative analytics including performance metrics and growth trends (Super Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cooperative analytics retrieved successfully',
    type: CooperativeAnalyticsDto,
  })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period for analytics (default: last_30_days)',
  })
  @ApiQuery({
    name: 'startDate',
    type: String,
    required: false,
    description: 'Start date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'endDate',
    type: String,
    required: false,
    description: 'End date for custom period (ISO 8601 format)',
  })
  async getCooperativeAnalytics(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: any,
  ): Promise<CooperativeAnalyticsDto> {
    try {
      this.logger.log(`Getting cooperative analytics for user ${user.id}`);
      return await this.analyticsService.getCooperativeAnalytics(query);
    } catch (error) {
      this.logger.error('Error fetching cooperative analytics:', error);
      throw error;
    }
  }

  @Get('activity')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get activity analytics',
    description:
      'Retrieve activity analytics including user behavior patterns and security events',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity analytics retrieved successfully',
    type: ActivityAnalyticsDto,
  })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period for analytics (default: last_30_days)',
  })
  @ApiQuery({
    name: 'startDate',
    type: String,
    required: false,
    description: 'Start date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'endDate',
    type: String,
    required: false,
    description: 'End date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'cooperativeId',
    type: String,
    required: false,
    description: 'Filter by specific cooperative',
  })
  async getActivityAnalytics(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: any,
  ): Promise<ActivityAnalyticsDto> {
    try {
      this.logger.log(`Getting activity analytics for user ${user.id}`);

      // If user is not SUPER_ADMIN, filter by their cooperative
      if (user.role === 'ORGANIZATION_ADMIN' && !query.cooperativeId) {
        query.cooperativeId = user.cooperativeId;
      }

      return await this.analyticsService.getActivityAnalytics(query);
    } catch (error) {
      this.logger.error('Error fetching activity analytics:', error);
      throw error;
    }
  }

  @Get('revenue')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'TREASURER')
  @ApiOperation({
    summary: 'Get revenue analytics',
    description:
      'Retrieve comprehensive revenue analytics including trends and breakdowns',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Revenue analytics retrieved successfully',
    type: RevenueAnalyticsDto,
  })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period for analytics (default: last_30_days)',
  })
  @ApiQuery({
    name: 'startDate',
    type: String,
    required: false,
    description: 'Start date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'endDate',
    type: String,
    required: false,
    description: 'End date for custom period (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'cooperativeId',
    type: String,
    required: false,
    description: 'Filter by specific cooperative',
  })
  async getRevenueAnalytics(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: any,
  ): Promise<RevenueAnalyticsDto> {
    try {
      this.logger.log(`Getting revenue analytics for user ${user.id}`);

      // If user is not SUPER_ADMIN, filter by their cooperative
      if (user.role !== 'SUPER_ADMIN' && !query.cooperativeId) {
        query.cooperativeId = user.cooperativeId;
      }

      return await this.analyticsService.getRevenueAnalytics(query);
    } catch (error) {
      this.logger.error('Error fetching revenue analytics:', error);
      throw error;
    }
  }

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'TREASURER', 'TENANT')
  @ApiOperation({
    summary: 'Get analytics summary',
    description:
      'Retrieve a comprehensive summary of all analytics data for quick overview',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics summary retrieved successfully',
  })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period for analytics (default: last_30_days)',
  })
  @ApiQuery({
    name: 'cooperativeId',
    type: String,
    required: false,
    description: 'Filter by specific cooperative',
  })
  async getAnalyticsSummary(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: any,
  ): Promise<{
    dashboard: DashboardStatsDto;
    payments: PaymentAnalyticsDto;
    users: UserAnalyticsDto;
    activity: ActivityAnalyticsDto;
    revenue: RevenueAnalyticsDto;
  }> {
    try {
      this.logger.log(`Getting analytics summary for user ${user.id}`);

      // If user is not SUPER_ADMIN, filter by their cooperative
      if (user.role !== 'SUPER_ADMIN' && !query.cooperativeId) {
        query.cooperativeId = user.cooperativeId;
      }

      // Fetch all analytics data in parallel
      const [dashboard, payments, users, activity, revenue] = await Promise.all(
        [
          this.analyticsService.getDashboardStats(query),
          this.analyticsService.getPaymentAnalytics(query),
          this.analyticsService.getUserAnalytics(query),
          this.analyticsService.getActivityAnalytics(query),
          this.analyticsService.getRevenueAnalytics(query),
        ],
      );

      return {
        dashboard,
        payments,
        users,
        activity,
        revenue,
      };
    } catch (error) {
      this.logger.error('Error fetching analytics summary:', error);
      throw error;
    }
  }

  @Get('export')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'TREASURER')
  @ApiOperation({
    summary: 'Export analytics data',
    description: 'Export analytics data in CSV format for external analysis',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics data exported successfully',
    headers: {
      'Content-Type': {
        description: 'MIME type of the exported file',
        schema: { type: 'string', example: 'text/csv' },
      },
      'Content-Disposition': {
        description: 'Attachment filename',
        schema: {
          type: 'string',
          example: 'attachment; filename="analytics-export.csv"',
        },
      },
    },
  })
  @ApiQuery({
    name: 'type',
    enum: [
      'dashboard',
      'payments',
      'users',
      'cooperatives',
      'activity',
      'revenue',
    ],
    required: true,
    description: 'Type of analytics data to export',
  })
  @ApiQuery({
    name: 'period',
    enum: TimePeriod,
    required: false,
    description: 'Time period for analytics (default: last_30_days)',
  })
  @ApiQuery({
    name: 'cooperativeId',
    type: String,
    required: false,
    description: 'Filter by specific cooperative',
  })
  async exportAnalytics(
    @Query() query: AnalyticsQueryDto & { type: string },
    @CurrentUser() user: any,
  ): Promise<string> {
    try {
      this.logger.log(`Exporting ${query.type} analytics for user ${user.id}`);

      // If user is not SUPER_ADMIN, filter by their cooperative
      if (user.role !== 'SUPER_ADMIN' && !query.cooperativeId) {
        query.cooperativeId = user.cooperativeId;
      }

      // For now, return a simple CSV string
      // In a real implementation, you would generate actual CSV data
      let csvData = '';

      switch (query.type) {
        case 'payments':
          const paymentData =
            await this.analyticsService.getPaymentAnalytics(query);
          csvData = this.generatePaymentsCsv(paymentData);
          break;
        case 'users':
          const userData = await this.analyticsService.getUserAnalytics(query);
          csvData = this.generateUsersCsv(userData);
          break;
        case 'revenue':
          const revenueData =
            await this.analyticsService.getRevenueAnalytics(query);
          csvData = this.generateRevenueCsv(revenueData);
          break;
        default:
          throw new Error(`Export type "${query.type}" not supported`);
      }

      return csvData;
    } catch (error) {
      this.logger.error('Error exporting analytics:', error);
      throw error;
    }
  }

  // Helper methods for CSV generation

  private generatePaymentsCsv(data: PaymentAnalyticsDto): string {
    let csv = 'Date,Volume,Amount,Success Rate\n';
    data.trends.forEach((trend) => {
      csv += `${trend.date},${trend.volume},${trend.amount},${data.successRate}\n`;
    });
    return csv;
  }

  private generateUsersCsv(data: UserAnalyticsDto): string {
    let csv = 'Date,Active Users,New Users\n';
    data.activityTrends.forEach((trend) => {
      csv += `${trend.date},${trend.activeUsers},${trend.newUsers}\n`;
    });
    return csv;
  }

  private generateRevenueCsv(data: RevenueAnalyticsDto): string {
    let csv = 'Date,Revenue,Transaction Count\n';
    data.revenueTrends.forEach((trend) => {
      csv += `${trend.date},${trend.revenue},${trend.transactionCount}\n`;
    });
    return csv;
  }
}
