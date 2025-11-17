import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { BalanceService } from '../application/balance.service';
import {
  CooperativeBalanceDto,
  CopayBalanceDto,
  BalanceOverviewDto,
  PaymentCalculationDto,
} from './dto/balance.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Balance Management')
@Controller('balances')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  @Get('overview')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get global balance overview',
    description:
      'Get comprehensive balance statistics for admin dashboard (Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Global balance overview retrieved successfully',
    type: BalanceOverviewDto,
  })
  async getGlobalOverview(): Promise<BalanceOverviewDto> {
    return this.balanceService.getGlobalBalanceOverview();
  }

  @Get('cooperative/:cooperativeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  @ApiOperation({
    summary: 'Get cooperative balance details',
    description:
      'Get balance information and statistics for a specific cooperative',
  })
  @ApiParam({
    name: 'cooperativeId',
    description: 'Cooperative ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Cooperative balance retrieved successfully',
  })
  async getCooperativeBalance(
    @Param('cooperativeId') cooperativeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Organization admins can only view their own cooperative balance
    if (
      user.role === UserRole.ORGANIZATION_ADMIN &&
      user.cooperativeId !== cooperativeId
    ) {
      throw new BadRequestException(
        'You can only view your own cooperative balance',
      );
    }

    return this.balanceService.getCooperativeBalanceStats(cooperativeId);
  }

  @Get('copay')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get CoPay profit balance',
    description:
      'Get CoPay fee collection balance and statistics (Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'CoPay balance retrieved successfully',
  })
  async getCopayBalance() {
    return this.balanceService.getCopayBalanceStats();
  }

  @Get('calculate')
  @ApiOperation({
    summary: 'Calculate payment with fees',
    description: 'Calculate total payment amount including transaction fees',
  })
  @ApiQuery({
    name: 'amount',
    description: 'Base payment amount',
    example: 50000,
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment calculation completed successfully',
    type: PaymentCalculationDto,
  })
  async calculatePaymentAmount(
    @Query('amount') amount: string,
  ): Promise<PaymentCalculationDto> {
    const baseAmount = parseFloat(amount);

    if (isNaN(baseAmount) || baseAmount <= 0) {
      throw new BadRequestException('Valid amount is required');
    }

    return this.balanceService.calculateTotalAmount(baseAmount);
  }

  @Get('cooperatives')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List all cooperative balances',
    description: 'Get summary of all cooperative balances (Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cooperative balances retrieved successfully',
  })
  async getAllCooperativeBalances() {
    // This would be useful for the admin dashboard to show all cooperative balances
    // For now, we'll return a simple implementation
    return {
      message: 'Feature coming soon - List all cooperative balances',
      note: 'Use the global overview endpoint for now',
    };
  }

  // Balance Redistribution Endpoints

  @Post('redistribute/payment/:paymentId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Redistribute balance for specific payment',
    description:
      'Manually trigger balance redistribution for a payment (Super Admin only)',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'Payment ID to redistribute balance for',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          description: 'Force redistribution even if already processed',
          default: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Balance redistribution completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        paymentId: { type: 'string' },
        cooperativeBalanceUpdated: { type: 'boolean' },
        feeBalanceUpdated: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Payment not eligible for redistribution',
  })
  async redistributePayment(
    @Param('paymentId') paymentId: string,
    @Body() body: { force?: boolean },
  ) {
    return this.balanceService.redistributePaymentBalance(
      paymentId,
      body.force || false,
    );
  }

  @Post('redistribute/batch')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Batch redistribute balances',
    description:
      'Process balance redistribution for multiple payments (Super Admin only)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        paymentIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of payment IDs to process',
        },
        cooperativeId: {
          type: 'string',
          description:
            'Process all pending payments for specific cooperative (optional)',
        },
        force: {
          type: 'boolean',
          description: 'Force redistribution even if already processed',
          default: false,
        },
        maxCount: {
          type: 'number',
          description: 'Maximum number of payments to process (max 100)',
          default: 50,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Batch redistribution completed',
    schema: {
      type: 'object',
      properties: {
        totalProcessed: { type: 'number' },
        successful: { type: 'number' },
        failed: { type: 'number' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              paymentId: { type: 'string' },
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async batchRedistribute(
    @Body()
    batchDto: {
      paymentIds?: string[];
      cooperativeId?: string;
      force?: boolean;
      maxCount?: number;
    },
  ) {
    return this.balanceService.batchRedistributeBalances(batchDto);
  }

  @Get('redistribute/pending')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get pending redistribution payments',
    description:
      'List payments that need balance redistribution (Super Admin only)',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Maximum number of results (max 100)',
    example: 50,
  })
  @ApiQuery({
    name: 'cooperativeId',
    type: String,
    required: false,
    description: 'Filter by cooperative ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending redistribution payments retrieved',
    schema: {
      type: 'object',
      properties: {
        pendingPayments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              paymentId: { type: 'string' },
              baseAmount: { type: 'number' },
              fee: { type: 'number' },
              cooperativeBalanceUpdated: { type: 'boolean' },
              feeBalanceUpdated: { type: 'boolean' },
              cooperativeName: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        totalPending: { type: 'number' },
        totalPendingAmount: { type: 'number' },
        totalPendingFees: { type: 'number' },
      },
    },
  })
  async getPendingRedistributions(
    @Query('limit') limit?: string,
    @Query('cooperativeId') cooperativeId?: string,
  ) {
    const maxLimit = limit ? Math.min(parseInt(limit), 100) : 50;
    return this.balanceService.getPendingRedistributions(
      maxLimit,
      cooperativeId,
    );
  }

  @Get('analysis/cooperative/:cooperativeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  @ApiOperation({
    summary: 'Get cooperative revenue analysis',
    description:
      'Get detailed revenue analysis for a specific cooperative including payment breakdowns and monthly trends',
  })
  @ApiParam({
    name: 'cooperativeId',
    description: 'Cooperative ID to analyze',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Start date for analysis (ISO 8601)',
    required: false,
    example: '2025-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'toDate',
    description: 'End date for analysis (ISO 8601)',
    required: false,
    example: '2025-12-31T23:59:59Z',
  })
  @ApiQuery({
    name: 'includeMonthlyBreakdown',
    description: 'Include monthly revenue breakdown',
    required: false,
    type: 'boolean',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Cooperative revenue analysis retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        cooperative: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            code: { type: 'string' },
          },
        },
        summary: {
          type: 'object',
          properties: {
            totalPayments: { type: 'number' },
            totalRevenue: { type: 'number', description: 'Amount received by cooperative (after platform fees)' },
            totalFees: { type: 'number', description: 'Platform fees collected' },
            totalPlatformRevenue: { type: 'number', description: 'Total amount paid by tenants' },
            averagePaymentAmount: { type: 'number' },
            averageFeePerPayment: { type: 'number' },
          },
        },
        paymentTypeBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              paymentType: { type: 'string' },
              count: { type: 'number' },
              revenue: { type: 'number' },
              fees: { type: 'number' },
            },
          },
        },
        monthlyBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              month: { type: 'string', example: '2025-01' },
              revenue: { type: 'number' },
              fees: { type: 'number' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getCooperativeAnalysis(
    @Param('cooperativeId') cooperativeId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('includeMonthlyBreakdown') includeMonthlyBreakdown?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    // Access control: Organization admins can only view their own cooperative
    if (
      user?.role === UserRole.ORGANIZATION_ADMIN &&
      user.cooperativeId !== cooperativeId
    ) {
      throw new BadRequestException(
        'You can only view your own cooperative analysis',
      );
    }

    const options: any = {};
    if (fromDate) options.fromDate = new Date(fromDate);
    if (toDate) options.toDate = new Date(toDate);
    if (includeMonthlyBreakdown === 'true') options.includeMonthlyBreakdown = true;

    return this.balanceService.getCooperativeRevenueAnalysis(cooperativeId, options);
  }

  @Get('analysis/platform-fees')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get platform fee analysis',
    description:
      'Get detailed platform fee analysis across all cooperatives or specific cooperative (Super Admin only)',
  })
  @ApiQuery({
    name: 'cooperativeId',
    description: 'Filter analysis for specific cooperative',
    required: false,
    example: '507f1f77bcf86cd799439012',
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Start date for analysis (ISO 8601)',
    required: false,
    example: '2025-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'toDate',
    description: 'End date for analysis (ISO 8601)',
    required: false,
    example: '2025-12-31T23:59:59Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform fee analysis retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            totalPayments: { type: 'number' },
            totalPlatformFees: { type: 'number' },
            totalCooperativeRevenue: { type: 'number' },
            totalProcessedAmount: { type: 'number' },
            averageFeePerPayment: { type: 'number' },
            platformFeePercentage: { type: 'number' },
          },
        },
        cooperativeBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              cooperative: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  code: { type: 'string' },
                },
              },
              totalPayments: { type: 'number' },
              totalRevenue: { type: 'number' },
              totalFees: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getPlatformFeeAnalysis(
    @Query('cooperativeId') cooperativeId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const options: any = {};
    if (cooperativeId) options.cooperativeId = cooperativeId;
    if (fromDate) options.fromDate = new Date(fromDate);
    if (toDate) options.toDate = new Date(toDate);

    return this.balanceService.getPlatformFeeAnalysis(options);
  }
}
