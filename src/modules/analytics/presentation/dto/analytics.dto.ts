import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export enum TimePeriod {
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom',
}

export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Time period for analytics',
    enum: TimePeriod,
    example: TimePeriod.LAST_30_DAYS,
    required: false,
  })
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod;

  @ApiProperty({
    description: 'Start date for custom period (ISO 8601 format)',
    example: '2025-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for custom period (ISO 8601 format)',
    example: '2025-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Cooperative ID to filter analytics (optional)',
    example: '68f0cb4bdceb5e16d57c9389',
    required: false,
  })
  @IsOptional()
  @IsString()
  cooperativeId?: string;
}

export class DashboardStatsDto {
  @ApiProperty({ description: 'Total number of active users' })
  totalUsers: number;

  @ApiProperty({ description: 'Total number of active cooperatives' })
  totalCooperatives: number;

  @ApiProperty({ description: 'Total payments processed' })
  totalPayments: number;

  @ApiProperty({ description: 'Total payment amount in RWF' })
  totalPaymentAmount: number;

  @ApiProperty({ description: 'Pending account requests' })
  pendingAccountRequests: number;

  @ApiProperty({ description: 'Active reminders' })
  activeReminders: number;

  @ApiProperty({ description: 'Open complaints' })
  openComplaints: number;

  @ApiProperty({ description: 'Growth percentage compared to previous period' })
  growthPercentage: {
    users: number;
    payments: number;
    revenue: number;
  };
}

export class PaymentAnalyticsDto {
  @ApiProperty({ description: 'Total payment volume' })
  totalVolume: number;

  @ApiProperty({ description: 'Total payment amount' })
  totalAmount: number;

  @ApiProperty({ description: 'Average payment amount' })
  averageAmount: number;

  @ApiProperty({ description: 'Payment success rate percentage' })
  successRate: number;

  @ApiProperty({ description: 'Most popular payment method' })
  mostPopularMethod: string;

  @ApiProperty({ description: 'Payment trends over time' })
  trends: Array<{
    date: string;
    volume: number;
    amount: number;
  }>;

  @ApiProperty({ description: 'Payment status distribution' })
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Payment method distribution' })
  methodDistribution: Array<{
    method: string;
    count: number;
    percentage: number;
  }>;
}

export class UserAnalyticsDto {
  @ApiProperty({ description: 'Total registered users' })
  totalUsers: number;

  @ApiProperty({ description: 'Active users in period' })
  activeUsers: number;

  @ApiProperty({ description: 'New registrations in period' })
  newRegistrations: number;

  @ApiProperty({ description: 'User growth rate percentage' })
  growthRate: number;

  @ApiProperty({ description: 'User activity trends' })
  activityTrends: Array<{
    date: string;
    activeUsers: number;
    newUsers: number;
  }>;

  @ApiProperty({ description: 'User role distribution' })
  roleDistribution: Array<{
    role: string;
    count: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'User status distribution' })
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

export class CooperativeAnalyticsDto {
  @ApiProperty({ description: 'Total cooperatives' })
  totalCooperatives: number;

  @ApiProperty({ description: 'Active cooperatives' })
  activeCooperatives: number;

  @ApiProperty({ description: 'Average members per cooperative' })
  averageMembers: number;

  @ApiProperty({ description: 'Top performing cooperatives' })
  topPerforming: Array<{
    id: string;
    name: string;
    memberCount: number;
    totalPayments: number;
    totalRevenue: number;
  }>;

  @ApiProperty({ description: 'Cooperative growth trends' })
  growthTrends: Array<{
    date: string;
    newCooperatives: number;
    totalMembers: number;
  }>;

  @ApiProperty({ description: 'Payment frequency distribution' })
  paymentFrequencyDistribution: Array<{
    frequency: string;
    count: number;
    percentage: number;
  }>;
}

export class ActivityAnalyticsDto {
  @ApiProperty({ description: 'Total activities recorded' })
  totalActivities: number;

  @ApiProperty({ description: 'Most common activity types' })
  topActivityTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Security events count' })
  securityEvents: number;

  @ApiProperty({ description: 'Failed login attempts' })
  failedLogins: number;

  @ApiProperty({ description: 'Activity trends over time' })
  activityTrends: Array<{
    date: string;
    totalActivities: number;
    securityEvents: number;
  }>;

  @ApiProperty({ description: 'Peak activity hours' })
  peakHours: Array<{
    hour: number;
    count: number;
  }>;
}

export class RevenueAnalyticsDto {
  @ApiProperty({ description: 'Total revenue generated' })
  totalRevenue: number;

  @ApiProperty({ description: 'Revenue growth percentage' })
  growthPercentage: number;

  @ApiProperty({ description: 'Average revenue per user' })
  averageRevenuePerUser: number;

  @ApiProperty({ description: 'Average revenue per cooperative' })
  averageRevenuePerCooperative: number;

  @ApiProperty({ description: 'Revenue trends over time' })
  revenueTrends: Array<{
    date: string;
    revenue: number;
    transactionCount: number;
  }>;

  @ApiProperty({ description: 'Revenue by cooperative' })
  revenueByCooperative: Array<{
    cooperativeId: string;
    cooperativeName: string;
    revenue: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Revenue by payment method' })
  revenueByMethod: Array<{
    method: string;
    revenue: number;
    percentage: number;
  }>;
}
