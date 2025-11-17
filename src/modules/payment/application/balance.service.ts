import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  BalanceTransactionType,
  BalanceTransactionStatus,
  PaymentStatus,
} from '@prisma/client';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(private prismaService: PrismaService) {}

  /**
   * Calculate fee for a payment amount
   * Fixed fee of 500 RWF for all transactions
   */
  calculatePaymentFee(baseAmount: number): number {
    // Fixed fee of 500 RWF for all payments
    return 500;
  }

  // Helper method to calculate baseAmount for legacy payments
  private getLegacyBaseAmount(payment: any): number {
    // If baseAmount exists and is valid, use it
    if (payment.baseAmount != null && payment.baseAmount > 0) {
      return payment.baseAmount;
    }
    
    // For legacy payments, calculate baseAmount from amount and fee
    const amount = payment.amount || 0;
    const fee = payment.fee || 500;
    return Math.max(0, amount - fee);
  }

  /**
   * Calculate total payment amount including fee
   */
  calculateTotalAmount(baseAmount: number): {
    baseAmount: number;
    fee: number;
    totalPaid: number;
  } {
    const fee = this.calculatePaymentFee(baseAmount);
    const totalPaid = baseAmount + fee;

    return {
      baseAmount,
      fee,
      totalPaid,
    };
  }

  /**
   * Get or create cooperative balance
   */
  async getOrCreateCooperativeBalance(cooperativeId: string) {
    let balance = await this.prismaService.cooperativeBalance.findUnique({
      where: { cooperativeId },
      include: {
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!balance) {
      balance = await this.prismaService.cooperativeBalance.create({
        data: {
          cooperativeId,
          currentBalance: 0,
          totalReceived: 0,
          totalWithdrawn: 0,
          pendingBalance: 0,
        },
        include: {
          cooperative: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });
    }

    return balance;
  }

  /**
   * Get or create CoPay balance (global fee tracking)
   */
  async getOrCreateCopayBalance() {
    let balance = await this.prismaService.copayBalance.findFirst();

    if (!balance) {
      balance = await this.prismaService.copayBalance.create({
        data: {
          currentBalance: 0,
          totalFees: 0,
          totalWithdrawn: 0,
          totalTransactions: 0,
          averageFeePerMonth: 0,
        },
      });
    }

    return balance;
  }

  /**
   * Process payment settlement - redistribute funds after IremboPay settles
   * Note: Using sequential processing instead of transactions due to MongoDB deployment limitations
   */
  async processPaymentSettlement(paymentId: string): Promise<void> {
    try {
      // Fetch payment details
      const payment = await this.prismaService.payment.findUnique({
        where: { id: paymentId },
        include: {
          cooperative: true,
          sender: true,
        },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException(
          `Payment ${paymentId} is not completed. Status: ${payment.status}`,
        );
      }

      // Check if already processed
      if (payment.cooperativeBalanceUpdated && payment.feeBalanceUpdated) {
        this.logger.warn(
          `Payment ${paymentId} already processed for balance redistribution`,
        );
        return;
      }

      // Process cooperative balance credit
      if (!payment.cooperativeBalanceUpdated) {
        try {
          const baseAmount = this.getLegacyBaseAmount(payment);
          await this.creditCooperativeBalance(
            payment.cooperativeId,
            baseAmount,
            paymentId,
            `Payment from ${payment.sender.firstName} ${payment.sender.lastName}`,
          );

          // Mark cooperative balance as updated
          await this.prismaService.payment.update({
            where: { id: paymentId },
            data: { cooperativeBalanceUpdated: true },
          });

          this.logger.log(
            `Credited ${baseAmount} RWF to cooperative ${payment.cooperative.name}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to credit cooperative balance for payment ${paymentId}: ${(error as Error).message}`,
          );
          throw error;
        }
      }

      // Process CoPay fee credit
      if (!payment.feeBalanceUpdated) {
        try {
          await this.creditCopayBalance(
            payment.fee,
            paymentId,
            `Transaction fee from payment ${payment.id}`,
          );

          // Mark fee balance as updated
          await this.prismaService.payment.update({
            where: { id: paymentId },
            data: { feeBalanceUpdated: true },
          });

          this.logger.log(
            `Collected ${payment.fee} RWF fee from payment ${payment.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to credit CoPay balance for payment ${paymentId}: ${(error as Error).message}`,
          );
          // If cooperative balance was already updated but fee balance fails,
          // we still want to mark it as a partial success
          throw error;
        }
      }

      this.logger.log(`Payment settlement completed successfully for payment ${paymentId}`);
    } catch (error) {
      this.logger.error(
        `Payment settlement failed for payment ${paymentId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Credit cooperative balance
   */
  async creditCooperativeBalance(
    cooperativeId: string,
    amount: number,
    referenceId?: string,
    description?: string,
  ) {

    // Get or create balance
    let balance = await this.prismaService.cooperativeBalance.findUnique({
      where: { cooperativeId },
    });

    if (!balance) {
      balance = await this.prismaService.cooperativeBalance.create({
        data: {
          cooperativeId,
          currentBalance: 0,
          totalReceived: 0,
          totalWithdrawn: 0,
          pendingBalance: 0,
        },
      });
    }

    // Update balance
    await this.prismaService.cooperativeBalance.update({
      where: { cooperativeId },
      data: {
        currentBalance: { increment: amount },
        totalReceived: { increment: amount },
        lastPaymentAt: new Date(),
      },
    });

    // Create balance transaction record
    await this.prismaService.balanceTransaction.create({
      data: {
        type: BalanceTransactionType.CREDIT_FROM_PAYMENT,
        amount,
        description: description || `Credit from payment`,
        referenceId,
        cooperativeBalanceId: balance.id,
        status: BalanceTransactionStatus.COMPLETED,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Credit CoPay balance (fees)
   */
  async creditCopayBalance(
    amount: number,
    referenceId?: string,
    description?: string,
  ) {

    // Get or create CoPay balance
    let balance = await this.prismaService.copayBalance.findFirst();

    if (!balance) {
      balance = await this.prismaService.copayBalance.create({
        data: {
          currentBalance: 0,
          totalFees: 0,
          totalWithdrawn: 0,
          totalTransactions: 0,
          averageFeePerMonth: 0,
        },
      });
    }

    // Update balance
    await this.prismaService.copayBalance.update({
      where: { id: balance.id },
      data: {
        currentBalance: { increment: amount },
        totalFees: { increment: amount },
        totalTransactions: { increment: 1 },
        lastFeeAt: new Date(),
      },
    });

    // Create balance transaction record
    await this.prismaService.balanceTransaction.create({
      data: {
        type: BalanceTransactionType.FEE_COLLECTION,
        amount,
        description: description || `Fee collection`,
        referenceId,
        copayBalanceId: balance.id,
        status: BalanceTransactionStatus.COMPLETED,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Get cooperative balance with statistics
   */
  async getCooperativeBalanceStats(cooperativeId: string) {
    const balance = await this.getOrCreateCooperativeBalance(cooperativeId);

    // Get recent transactions
    const recentTransactions =
      await this.prismaService.balanceTransaction.findMany({
        where: { cooperativeBalanceId: balance.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          cooperativeBalance: {
            include: {
              cooperative: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      });

    // Calculate monthly stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyCredits =
      await this.prismaService.balanceTransaction.aggregate({
        where: {
          cooperativeBalanceId: balance.id,
          type: BalanceTransactionType.CREDIT_FROM_PAYMENT,
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
        _count: true,
      });

    return {
      balance,
      recentTransactions,
      monthlyStats: {
        totalCredits: monthlyCredits._sum.amount || 0,
        transactionCount: monthlyCredits._count,
        averagePerTransaction:
          monthlyCredits._count > 0
            ? (monthlyCredits._sum.amount || 0) / monthlyCredits._count
            : 0,
      },
    };
  }

  /**
   * Get CoPay balance with global statistics
   */
  async getCopayBalanceStats() {
    const balance = await this.getOrCreateCopayBalance();

    // Get recent fee collections
    const recentTransactions =
      await this.prismaService.balanceTransaction.findMany({
        where: { copayBalanceId: balance.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

    // Calculate monthly fee collection
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyFees = await this.prismaService.balanceTransaction.aggregate({
      where: {
        copayBalanceId: balance.id,
        type: BalanceTransactionType.FEE_COLLECTION,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      balance,
      recentTransactions,
      monthlyStats: {
        totalFees: monthlyFees._sum.amount || 0,
        transactionCount: monthlyFees._count,
        averageFeePerDay:
          monthlyFees._count > 0 ? (monthlyFees._sum.amount || 0) / 30 : 0,
      },
    };
  }

  /**
   * Get global balance overview for admin dashboard
   */
  async getGlobalBalanceOverview() {
    // Get total cooperative balances
    const cooperativeBalances =
      await this.prismaService.cooperativeBalance.aggregate({
        _sum: {
          currentBalance: true,
          totalReceived: true,
          pendingBalance: true,
        },
        _count: true,
      });

    // Get CoPay balance
    const copayBalance = await this.getOrCreateCopayBalance();

    // Get today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions =
      await this.prismaService.balanceTransaction.aggregate({
        where: {
          createdAt: { gte: today },
          status: BalanceTransactionStatus.COMPLETED,
        },
        _sum: { amount: true },
        _count: true,
      });

    return {
      totalCooperatives: cooperativeBalances._count,
      totalCooperativeBalance: cooperativeBalances._sum.currentBalance || 0,
      totalPendingBalance: cooperativeBalances._sum.pendingBalance || 0,
      totalReceivedAllTime: cooperativeBalances._sum.totalReceived || 0,
      copayProfit: {
        currentBalance: copayBalance.currentBalance,
        totalFeesCollected: copayBalance.totalFees,
        totalTransactions: copayBalance.totalTransactions,
      },
      todayActivity: {
        totalAmount: todayTransactions._sum.amount || 0,
        transactionCount: todayTransactions._count,
      },
    };
  }

  // Balance Redistribution Methods

  async redistributePaymentBalance(
    paymentId: string,
    force: boolean = false
  ) {
    this.logger.log(`Redistributing balance for payment ${paymentId}, force: ${force}`);

    // Get payment with all related data
    const payment = await this.prismaService.payment.findUnique({
      where: { id: paymentId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        cooperative: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check if payment is eligible for redistribution
    if (!force && payment.cooperativeBalanceUpdated && payment.feeBalanceUpdated) {
      throw new BadRequestException(
        'Payment balance has already been redistributed. Use force=true to redistribute anyway.'
      );
    }

    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Only completed payments can be redistributed'
      );
    }

    let cooperativeUpdated = payment.cooperativeBalanceUpdated;
    let feeUpdated = payment.feeBalanceUpdated;

    try {
      // Process cooperative balance credit if needed
      if (!cooperativeUpdated || force) {
        const baseAmount = this.getLegacyBaseAmount(payment);
        await this.creditCooperativeBalance(
          payment.cooperativeId,
          baseAmount,
          paymentId,
          `Manual redistribution: Payment from ${payment.sender.firstName} ${payment.sender.lastName}`,
        );

        await this.prismaService.payment.update({
          where: { id: paymentId },
          data: { cooperativeBalanceUpdated: true },
        });

        cooperativeUpdated = true;
        this.logger.log(
          `Manually credited ${baseAmount} RWF to cooperative ${payment.cooperative.name}`
        );
      }

      // Process CoPay fee credit if needed
      if (!feeUpdated || force) {
        const fee = payment.fee || 500;
        await this.creditCopayBalance(
          fee,
          paymentId,
          `Manual redistribution: Transaction fee from payment ${paymentId}`,
        );

        await this.prismaService.payment.update({
          where: { id: paymentId },
          data: { feeBalanceUpdated: true },
        });

        feeUpdated = true;
        this.logger.log(
          `Manually credited ${fee} RWF fee to CoPay balance`
        );
      }

      return {
        success: true,
        paymentId,
        cooperativeBalanceUpdated: cooperativeUpdated,
        feeBalanceUpdated: feeUpdated,
        message: 'Balance redistribution completed successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to redistribute balance for payment ${paymentId}: ${(error as Error).message}`
      );
      throw error;
    }
  }

  async batchRedistributeBalances(options: {
    paymentIds?: string[];
    cooperativeId?: string;
    force?: boolean;
    maxCount?: number;
  }) {
    const { paymentIds, cooperativeId, force = false, maxCount = 50 } = options;
    const limit = Math.min(maxCount, 100); // Safety limit

    let paymentsToProcess: any[] = [];

    if (paymentIds && paymentIds.length > 0) {
      // Process specific payment IDs
      paymentsToProcess = await this.prismaService.payment.findMany({
        where: {
          id: { in: paymentIds },
          status: 'COMPLETED',
        },
        take: limit,
        include: {
          sender: { select: { firstName: true, lastName: true } },
          cooperative: { select: { name: true } },
        },
      });
    } else {
      // Find pending redistribution payments
      const whereClause: any = {
        status: 'COMPLETED',
        OR: [
          { cooperativeBalanceUpdated: false },
          { feeBalanceUpdated: false },
        ],
      };

      if (cooperativeId) {
        whereClause.cooperativeId = cooperativeId;
      }

      paymentsToProcess = await this.prismaService.payment.findMany({
        where: whereClause,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { firstName: true, lastName: true } },
          cooperative: { select: { name: true } },
        },
      });
    }

    const results: Array<{
      paymentId: string;
      success: boolean;
      message: string;
    }> = [];
    let successful = 0;
    let failed = 0;

    for (const payment of paymentsToProcess) {
      try {
        const result = await this.redistributePaymentBalance(payment.id, force);
        results.push({
          paymentId: payment.id,
          success: true,
          message: result.message,
        });
        successful++;
      } catch (error) {
        results.push({
          paymentId: payment.id,
          success: false,
          message: (error as Error).message,
        });
        failed++;
      }
    }

    return {
      totalProcessed: paymentsToProcess.length,
      successful,
      failed,
      results,
    };
  }

  async getPendingRedistributions(limit: number = 50, cooperativeId?: string) {
    const whereClause: any = {
      status: 'COMPLETED',
      OR: [
        { cooperativeBalanceUpdated: false },
        { feeBalanceUpdated: false },
      ],
    };

    if (cooperativeId) {
      whereClause.cooperativeId = cooperativeId;
    }

    const pendingPayments = await this.prismaService.payment.findMany({
      where: whereClause,
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        baseAmount: true,
        fee: true,
        amount: true,
        cooperativeBalanceUpdated: true,
        feeBalanceUpdated: true,
        createdAt: true,
        cooperative: {
          select: {
            name: true,
          },
        },
      },
    });

    const totalPendingCount = await this.prismaService.payment.count({
      where: whereClause,
    });

    // Calculate totals
    let totalPendingAmount = 0;
    let totalPendingFees = 0;

    const formattedPayments = pendingPayments.map(payment => {
      const baseAmount = this.getLegacyBaseAmount(payment);
      const fee = payment.fee || 500;

      if (!payment.cooperativeBalanceUpdated) {
        totalPendingAmount += baseAmount;
      }
      if (!payment.feeBalanceUpdated) {
        totalPendingFees += fee;
      }

      return {
        paymentId: payment.id,
        baseAmount,
        fee,
        cooperativeBalanceUpdated: payment.cooperativeBalanceUpdated,
        feeBalanceUpdated: payment.feeBalanceUpdated,
        cooperativeName: payment.cooperative.name,
        createdAt: payment.createdAt,
      };
    });

    return {
      pendingPayments: formattedPayments,
      totalPending: totalPendingCount,
      totalPendingAmount,
      totalPendingFees,
    };
  }

  /**
   * Get detailed revenue analysis for a specific cooperative
   */
  async getCooperativeRevenueAnalysis(cooperativeId: string, options?: {
    fromDate?: Date;
    toDate?: Date;
    includeMonthlyBreakdown?: boolean;
  }) {
    const { fromDate, toDate, includeMonthlyBreakdown = false } = options || {};

    // Build date filter
    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = fromDate;
    if (toDate) dateFilter.lte = toDate;

    // Get cooperative info
    const cooperative = await this.prismaService.cooperative.findUnique({
      where: { id: cooperativeId },
      select: { id: true, name: true, code: true },
    });

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    // Get all completed payments for this cooperative
    const payments = await this.prismaService.payment.findMany({
      where: {
        cooperativeId,
        status: 'COMPLETED',
        ...(Object.keys(dateFilter).length > 0 ? { paidAt: dateFilter } : {}),
      },
      select: {
        id: true,
        amount: true,
        baseAmount: true,
        fee: true,
        paidAt: true,
        createdAt: true,
        paymentType: {
          select: {
            id: true,
            name: true,
          },
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    // Calculate totals
    let totalRevenue = 0;
    let totalFees = 0;
    let totalPlatformRevenue = 0;
    const paymentTypeBreakdown: Record<string, { count: number; revenue: number; fees: number }> = {};

    payments.forEach(payment => {
      const baseAmount = this.getLegacyBaseAmount(payment);
      const fee = payment.fee || 500;
      const totalPaid = payment.amount;

      totalRevenue += baseAmount;
      totalFees += fee;
      totalPlatformRevenue += totalPaid;

      // Payment type breakdown
      const paymentTypeName = payment.paymentType?.name || 'Unknown';
      if (!paymentTypeBreakdown[paymentTypeName]) {
        paymentTypeBreakdown[paymentTypeName] = { count: 0, revenue: 0, fees: 0 };
      }
      paymentTypeBreakdown[paymentTypeName].count++;
      paymentTypeBreakdown[paymentTypeName].revenue += baseAmount;
      paymentTypeBreakdown[paymentTypeName].fees += fee;
    });

    // Monthly breakdown if requested
    let monthlyBreakdown: any[] = [];
    if (includeMonthlyBreakdown) {
      const monthlyData: Record<string, { revenue: number; fees: number; count: number }> = {};
      
      payments.forEach(payment => {
        const month = payment.paidAt ? 
          payment.paidAt.toISOString().substring(0, 7) : // YYYY-MM format
          payment.createdAt.toISOString().substring(0, 7);
        
        if (!monthlyData[month]) {
          monthlyData[month] = { revenue: 0, fees: 0, count: 0 };
        }
        
        const baseAmount = this.getLegacyBaseAmount(payment);
        const fee = payment.fee || 500;
        
        monthlyData[month].revenue += baseAmount;
        monthlyData[month].fees += fee;
        monthlyData[month].count++;
      });
      
      monthlyBreakdown = Object.entries(monthlyData)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }

    return {
      cooperative,
      summary: {
        totalPayments: payments.length,
        totalRevenue, // Amount received by cooperative (after platform fees)
        totalFees, // Platform fees collected
        totalPlatformRevenue, // Total amount paid by tenants
        averagePaymentAmount: payments.length > 0 ? totalRevenue / payments.length : 0,
        averageFeePerPayment: payments.length > 0 ? totalFees / payments.length : 0,
      },
      paymentTypeBreakdown: Object.entries(paymentTypeBreakdown).map(([name, data]) => ({
        paymentType: name,
        ...data,
      })),
      monthlyBreakdown,
      dateRange: {
        fromDate: fromDate?.toISOString() || null,
        toDate: toDate?.toISOString() || null,
      },
    };
  }

  /**
   * Get platform fee analysis across all cooperatives or specific cooperative
   */
  async getPlatformFeeAnalysis(options?: {
    cooperativeId?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const { cooperativeId, fromDate, toDate } = options || {};

    // Build filters
    const whereClause: any = {
      status: 'COMPLETED',
    };

    if (cooperativeId) {
      whereClause.cooperativeId = cooperativeId;
    }

    if (fromDate || toDate) {
      const dateFilter: any = {};
      if (fromDate) dateFilter.gte = fromDate;
      if (toDate) dateFilter.lte = toDate;
      whereClause.paidAt = dateFilter;
    }

    // Get payments and cooperatives
    const payments = await this.prismaService.payment.findMany({
      where: whereClause,
      select: {
        id: true,
        amount: true,
        baseAmount: true,
        fee: true,
        paidAt: true,
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Group by cooperative
    const cooperativeBreakdown: Record<string, {
      cooperative: any;
      totalPayments: number;
      totalRevenue: number;
      totalFees: number;
    }> = {};

    let totalPlatformFees = 0;
    let totalCooperativeRevenue = 0;
    let totalPayments = payments.length;

    payments.forEach(payment => {
      const cooperativeId = payment.cooperative.id;
      const baseAmount = this.getLegacyBaseAmount(payment);
      const fee = payment.fee || 500;

      totalPlatformFees += fee;
      totalCooperativeRevenue += baseAmount;

      if (!cooperativeBreakdown[cooperativeId]) {
        cooperativeBreakdown[cooperativeId] = {
          cooperative: payment.cooperative,
          totalPayments: 0,
          totalRevenue: 0,
          totalFees: 0,
        };
      }

      cooperativeBreakdown[cooperativeId].totalPayments++;
      cooperativeBreakdown[cooperativeId].totalRevenue += baseAmount;
      cooperativeBreakdown[cooperativeId].totalFees += fee;
    });

    return {
      summary: {
        totalPayments,
        totalPlatformFees,
        totalCooperativeRevenue,
        totalProcessedAmount: totalPlatformFees + totalCooperativeRevenue,
        averageFeePerPayment: totalPayments > 0 ? totalPlatformFees / totalPayments : 0,
        platformFeePercentage: totalPayments > 0 ? 
          (totalPlatformFees / (totalPlatformFees + totalCooperativeRevenue)) * 100 : 0,
      },
      cooperativeBreakdown: Object.values(cooperativeBreakdown).sort((a, b) => 
        b.totalFees - a.totalFees
      ),
      dateRange: {
        fromDate: fromDate?.toISOString() || null,
        toDate: toDate?.toISOString() || null,
      },
    };
  }
}
