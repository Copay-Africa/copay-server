import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BalanceTransactionType,
  BalanceTransactionStatus,
} from '@prisma/client';

export class CooperativeBalanceDto {
  @ApiProperty({
    description: 'Balance ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Cooperative ID',
    example: '507f1f77bcf86cd799439012',
  })
  cooperativeId: string;

  @ApiProperty({
    description: 'Current available balance',
    example: 150000,
  })
  currentBalance: number;

  @ApiProperty({
    description: 'Total amount received from payments',
    example: 500000,
  })
  totalReceived: number;

  @ApiProperty({
    description: 'Total amount withdrawn',
    example: 350000,
  })
  totalWithdrawn: number;

  @ApiProperty({
    description: 'Pending balance from processing payments',
    example: 25000,
  })
  pendingBalance: number;

  @ApiPropertyOptional({
    description: 'Last payment received timestamp',
  })
  lastPaymentAt?: Date;

  @ApiPropertyOptional({
    description: 'Last withdrawal timestamp',
  })
  lastWithdrawalAt?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Cooperative information',
  })
  cooperative?: {
    id: string;
    name: string;
    code: string;
  };
}

export class CopayBalanceDto {
  @ApiProperty({
    description: 'Balance ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Current profit balance',
    example: 75000,
  })
  currentBalance: number;

  @ApiProperty({
    description: 'Total fees collected',
    example: 125000,
  })
  totalFees: number;

  @ApiProperty({
    description: 'Total amount withdrawn',
    example: 50000,
  })
  totalWithdrawn: number;

  @ApiProperty({
    description: 'Total number of fee transactions',
    example: 250,
  })
  totalTransactions: number;

  @ApiProperty({
    description: 'Average fee collected per month',
    example: 15000,
  })
  averageFeePerMonth: number;

  @ApiPropertyOptional({
    description: 'Last fee collection timestamp',
  })
  lastFeeAt?: Date;

  @ApiPropertyOptional({
    description: 'Last withdrawal timestamp',
  })
  lastWithdrawalAt?: Date;

  @ApiPropertyOptional({
    description: 'When averages were last calculated',
  })
  lastCalculatedAt?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

export class BalanceTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: BalanceTransactionType,
    example: BalanceTransactionType.CREDIT_FROM_PAYMENT,
  })
  type: BalanceTransactionType;

  @ApiProperty({
    description: 'Transaction amount',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Transaction description',
    example: 'Payment from John Doe',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Reference ID (payment ID, etc.)',
    example: '507f1f77bcf86cd799439012',
  })
  referenceId?: string;

  @ApiPropertyOptional({
    description: 'External reference (bank transfer, etc.)',
    example: 'BK20251117001234',
  })
  externalReference?: string;

  @ApiProperty({
    description: 'Transaction status',
    enum: BalanceTransactionStatus,
    example: BalanceTransactionStatus.COMPLETED,
  })
  status: BalanceTransactionStatus;

  @ApiPropertyOptional({
    description: 'User who processed the transaction',
    example: '507f1f77bcf86cd799439013',
  })
  processedBy?: string;

  @ApiPropertyOptional({
    description: 'User who approved the transaction',
    example: '507f1f77bcf86cd799439013',
  })
  approvedBy?: string;

  @ApiPropertyOptional({
    description: 'When transaction was processed',
  })
  processedAt?: Date;

  @ApiPropertyOptional({
    description: 'Failure reason if transaction failed',
  })
  failureReason?: string;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

export class BalanceOverviewDto {
  @ApiProperty({
    description: 'Total number of cooperatives with balances',
    example: 25,
  })
  totalCooperatives: number;

  @ApiProperty({
    description: 'Total balance across all cooperatives',
    example: 2500000,
  })
  totalCooperativeBalance: number;

  @ApiProperty({
    description: 'Total pending balance (processing payments)',
    example: 150000,
  })
  totalPendingBalance: number;

  @ApiProperty({
    description: 'Total received amount across all cooperatives (all-time)',
    example: 15000000,
  })
  totalReceivedAllTime: number;

  @ApiProperty({
    description: 'CoPay profit information',
  })
  copayProfit: {
    currentBalance: number;
    totalFeesCollected: number;
    totalTransactions: number;
  };

  @ApiProperty({
    description: "Today's activity statistics",
  })
  todayActivity: {
    totalAmount: number;
    transactionCount: number;
  };
}

export class PaymentCalculationDto {
  @ApiProperty({
    description: 'Base payment amount (before fees)',
    example: 50000,
  })
  baseAmount: number;

  @ApiProperty({
    description: 'Transaction fee',
    example: 500,
  })
  fee: number;

  @ApiProperty({
    description: 'Total amount to be paid',
    example: 50500,
  })
  totalPaid: number;
}
