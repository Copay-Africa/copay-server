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
    return 500; // Fixed 500 RWF transaction fee
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
   */
  async processPaymentSettlement(paymentId: string): Promise<void> {
    // Start a transaction to ensure consistency
    await this.prismaService.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
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

      // Credit cooperative balance with baseAmount
      if (!payment.cooperativeBalanceUpdated) {
        await this.creditCooperativeBalance(
          payment.cooperativeId,
          payment.baseAmount,
          paymentId,
          `Payment from ${payment.sender.firstName} ${payment.sender.lastName}`,
          tx,
        );

        // Mark as processed
        await tx.payment.update({
          where: { id: paymentId },
          data: { cooperativeBalanceUpdated: true },
        });

        this.logger.log(
          `Credited ${payment.baseAmount} RWF to cooperative ${payment.cooperative.name}`,
        );
      }

      // Credit CoPay balance with fee
      if (!payment.feeBalanceUpdated) {
        await this.creditCopayBalance(
          payment.fee,
          paymentId,
          `Transaction fee from payment ${payment.id}`,
          tx,
        );

        // Mark as processed
        await tx.payment.update({
          where: { id: paymentId },
          data: { feeBalanceUpdated: true },
        });

        this.logger.log(
          `Collected ${payment.fee} RWF fee from payment ${payment.id}`,
        );
      }
    });
  }

  /**
   * Credit cooperative balance
   */
  async creditCooperativeBalance(
    cooperativeId: string,
    amount: number,
    referenceId?: string,
    description?: string,
    tx?: any,
  ) {
    const prisma = tx || this.prismaService;

    // Get or create balance
    let balance = await prisma.cooperativeBalance.findUnique({
      where: { cooperativeId },
    });

    if (!balance) {
      balance = await prisma.cooperativeBalance.create({
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
    await prisma.cooperativeBalance.update({
      where: { cooperativeId },
      data: {
        currentBalance: { increment: amount },
        totalReceived: { increment: amount },
        lastPaymentAt: new Date(),
      },
    });

    // Create balance transaction record
    await prisma.balanceTransaction.create({
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
    tx?: any,
  ) {
    const prisma = tx || this.prismaService;

    // Get or create CoPay balance
    let balance = await prisma.copayBalance.findFirst();

    if (!balance) {
      balance = await prisma.copayBalance.create({
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
    await prisma.copayBalance.update({
      where: { id: balance.id },
      data: {
        currentBalance: { increment: amount },
        totalFees: { increment: amount },
        totalTransactions: { increment: 1 },
        lastFeeAt: new Date(),
      },
    });

    // Create balance transaction record
    await prisma.balanceTransaction.create({
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
}
