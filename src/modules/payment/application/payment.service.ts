import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../../prisma/prisma.service';
import { InitiatePaymentDto } from '../presentation/dto/initiate-payment.dto';
import { PaymentResponseDto } from '../presentation/dto/payment-response.dto';
import { PaymentWebhookDto } from '../presentation/dto/payment-webhook.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { PaymentStatus, PaymentAmountType, UserRole } from '@prisma/client';
import { PaymentGatewayFactory } from '../infrastructure/payment-gateway.factory';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private paymentGatewayFactory: PaymentGatewayFactory,
  ) {}

  async initiatePayment(
    initiatePaymentDto: InitiatePaymentDto,
    senderId: string,
    targetCooperativeId?: string, // Allow specifying target cooperative
  ): Promise<PaymentResponseDto> {
    // Get payment type and validate first
    const paymentType = await this.prismaService.paymentType.findUnique({
      where: { id: initiatePaymentDto.paymentTypeId },
      include: { cooperative: true },
    });

    if (!paymentType) {
      throw new NotFoundException('Payment type not found');
    }

    if (!paymentType.isActive) {
      throw new BadRequestException('Payment type is not active');
    }

    // Use the cooperative ID from the payment type if no target cooperative specified
    const cooperativeId = targetCooperativeId || paymentType.cooperativeId;

    const existingPayment = await this.prismaService.payment.findFirst({
      where: {
        idempotencyKey: initiatePaymentDto.idempotencyKey,
      },
    });

    if (existingPayment) {
      return this.findById(existingPayment.id, senderId, cooperativeId);
    }

    // Validate cooperative access (users can pay for any active cooperative)
    const cooperative = await this.prismaService.cooperative.findUnique({
      where: { id: cooperativeId },
    });

    if (!cooperative || cooperative.status !== 'ACTIVE') {
      throw new BadRequestException('Cooperative is not available for payments');
    }

    // Ensure payment type belongs to the target cooperative
    if (paymentType.cooperativeId !== cooperativeId) {
      throw new BadRequestException(
        'Payment type does not belong to the specified cooperative',
      );
    }

    // Validate payment amount based on payment type rules
    await this.validatePaymentAmount(initiatePaymentDto.amount, paymentType);

    // Create payment record
    const payment = await this.prismaService.payment.create({
      data: {
        amount: initiatePaymentDto.amount,
        status: PaymentStatus.PENDING,
        description: initiatePaymentDto.description,
        dueDate: initiatePaymentDto.dueDate
          ? new Date(initiatePaymentDto.dueDate)
          : null,
        paymentTypeId: initiatePaymentDto.paymentTypeId,
        paymentMethod: initiatePaymentDto.paymentMethod,
        paymentReference: null, // Will be set after gateway response
        idempotencyKey: initiatePaymentDto.idempotencyKey,
        cooperativeId,
        senderId,
        isGroupPayment: false,
      },
      include: {
        paymentType: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        sender: {
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

    try {
      const gateway = this.paymentGatewayFactory.getGateway(
        initiatePaymentDto.paymentMethod,
      );

      // Prepare gateway request
      const gatewayRequest = {
        amount: initiatePaymentDto.amount,
        currency: 'RWF',
        paymentMethod: initiatePaymentDto.paymentMethod,
        paymentAccount: initiatePaymentDto.paymentAccount,
        reference: payment.id,
        description:
          initiatePaymentDto.description ||
          paymentType.description ||
          'Payment',
        callbackUrl: `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v1/webhooks/payments/irembopay`,
      };

      // Initiate payment with gateway
      const gatewayResponse = await gateway.initiatePayment(gatewayRequest);

      // Use idempotency key as fallback if gateway transaction ID is not available
      const transactionId =
        gatewayResponse.gatewayTransactionId ||
        `fallback_${initiatePaymentDto.idempotencyKey}`;

      let paymentTransaction;
      try {
        paymentTransaction = await this.prismaService.paymentTransaction.create(
          {
            data: {
              paymentId: payment.id,
              amount: initiatePaymentDto.amount,
              status: gatewayResponse.success
                ? PaymentStatus.PENDING
                : PaymentStatus.FAILED,
              paymentMethod: initiatePaymentDto.paymentMethod,
              gatewayTransactionId: transactionId,
              gatewayReference: gatewayResponse.gatewayReference,
              gatewayResponse: gatewayResponse.data,
              idempotencyKey: `tx_${initiatePaymentDto.idempotencyKey}`,
              cooperativeId,
            },
          },
        );
      } catch (error: any) {
        // If it's a unique constraint violation on gatewayTransactionId
        if (
          error.code === 'P2002' &&
          error.meta?.target?.includes('gatewayTransactionId')
        ) {
          // Check if gatewayTransactionId is valid before using it
          if (gatewayResponse.gatewayTransactionId) {
            // Try to find existing transaction with same gateway transaction ID
            paymentTransaction =
              await this.prismaService.paymentTransaction.findUnique({
                where: {
                  gatewayTransactionId: gatewayResponse.gatewayTransactionId,
                },
              });
          } else {
            paymentTransaction = null;
          }

          if (paymentTransaction) {
            // Update the existing transaction with latest gateway response
            paymentTransaction =
              await this.prismaService.paymentTransaction.update({
                where: { id: paymentTransaction.id },
                data: {
                  gatewayResponse: gatewayResponse.data,
                  status: gatewayResponse.success
                    ? PaymentStatus.PENDING
                    : PaymentStatus.FAILED,
                },
              });
          } else {
            // If we can't find existing transaction, create with modified ID
            const uniqueGatewayId = `${transactionId}_${Date.now()}`;

            paymentTransaction =
              await this.prismaService.paymentTransaction.create({
                data: {
                  paymentId: payment.id,
                  amount: initiatePaymentDto.amount,
                  status: gatewayResponse.success
                    ? PaymentStatus.PENDING
                    : PaymentStatus.FAILED,
                  paymentMethod: initiatePaymentDto.paymentMethod,
                  gatewayTransactionId: uniqueGatewayId,
                  gatewayReference: gatewayResponse.gatewayReference,
                  gatewayResponse: gatewayResponse.data,
                  idempotencyKey: `tx_${initiatePaymentDto.idempotencyKey}`,
                  cooperativeId,
                },
              });
          }
        } else {
          // Re-throw other errors
          throw error;
        }
      }

      // Update payment record with gateway information
      await this.prismaService.payment.update({
        where: { id: payment.id },
        data: {
          paymentReference: gatewayResponse.gatewayReference || payment.id,
          status: gatewayResponse.success
            ? PaymentStatus.PENDING
            : PaymentStatus.FAILED,
        },
      });

      // Refresh payment data to include updates
      const updatedPayment = await this.prismaService.payment.findUnique({
        where: { id: payment.id },
        include: {
          paymentType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          sender: {
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

      const responseDto = this.mapToResponseDto(updatedPayment);

      // Add gateway-specific information to response
      if (gatewayResponse.paymentUrl) {
        (responseDto as any).paymentUrl = gatewayResponse.paymentUrl;
      }

      (responseDto as any).gatewayMessage = gatewayResponse.message;
      (responseDto as any).gatewayTransactionId =
        gatewayResponse.gatewayTransactionId;

      return responseDto;
    } catch (error) {
      // If gateway integration fails, update payment status to failed
      await this.prismaService.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      throw error;
    }
  }

  async findById(
    id: string,
    currentUserId: string,
    cooperativeId: string,
    currentUserRole?: UserRole,
  ): Promise<PaymentResponseDto> {
    const payment = await this.prismaService.payment.findUnique({
      where: { id },
      include: {
        paymentType: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        sender: {
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

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check access permissions
    if (currentUserRole !== UserRole.SUPER_ADMIN) {
      // Organization admins can see all payments in their cooperative
      if (currentUserRole === UserRole.ORGANIZATION_ADMIN) {
        if (payment.cooperativeId !== cooperativeId) {
          throw new NotFoundException('Payment not found');
        }
      } else {
        // Tenants can only see their own payments
        if (payment.senderId !== currentUserId) {
          throw new NotFoundException('Payment not found');
        }
      }
    }

    return this.mapToResponseDto(payment);
  }

  async findAllByUser(
    currentUserId: string,
    cooperativeId: string,
    paginationDto: PaginationDto,
    currentUserRole?: UserRole,
  ): Promise<PaginatedResponseDto<PaymentResponseDto>> {
    const { page, limit, search, sortBy, sortOrder, skip } = paginationDto;

    // Build where clause based on user role
    const where: any = {};

    if (currentUserRole === UserRole.SUPER_ADMIN) {
      // Super admins can see all payments
      if (search) {
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { paymentReference: { contains: search, mode: 'insensitive' } },
        ];
      }
    } else if (currentUserRole === UserRole.ORGANIZATION_ADMIN) {
      // Organization admins see all payments in their cooperative
      where.cooperativeId = cooperativeId;
      if (search) {
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { paymentReference: { contains: search, mode: 'insensitive' } },
        ];
      }
    } else {
      // Tenants see only their own payments
      where.senderId = currentUserId;
      if (search) {
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { paymentReference: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    // Execute queries
    const [payments, total] = await Promise.all([
      this.prismaService.payment.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          paymentType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          sender: {
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
      this.prismaService.payment.count({ where }),
    ]);

    const paymentResponses = payments.map((payment) =>
      this.mapToResponseDto(payment),
    );

    return new PaginatedResponseDto(
      paymentResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async handleWebhook(webhookDto: PaymentWebhookDto): Promise<void> {
    // Find payment transaction by gateway transaction ID
    const paymentTransaction =
      await this.prismaService.paymentTransaction.findUnique({
        where: {
          gatewayTransactionId: webhookDto.gatewayTransactionId,
        },
        include: {
          payment: true,
        },
      });

    if (!paymentTransaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    // Update payment transaction
    await this.prismaService.paymentTransaction.update({
      where: {
        id: paymentTransaction.id,
      },
      data: {
        status: webhookDto.status,
        gatewayReference: webhookDto.gatewayReference,
        failureReason: webhookDto.failureReason,
        gatewayResponse: webhookDto.gatewayData,
        webhookReceived: true,
        webhookReceivedAt: new Date(),
        webhookData: JSON.stringify(webhookDto),
        processingCompletedAt: new Date(),
      },
    });

    // Update main payment record
    const updateData: any = {
      status: webhookDto.status,
    };

    if (webhookDto.status === PaymentStatus.COMPLETED) {
      updateData.paidAt = new Date();
    }

    if (webhookDto.gatewayReference) {
      updateData.paymentReference = webhookDto.gatewayReference;
    }

    await this.prismaService.payment.update({
      where: {
        id: paymentTransaction.paymentId,
      },
      data: updateData,
    });

    // TODO: Add notification logic here
    // - Send SMS/Email to user about payment status
    // - Notify organization admin if needed
    // - Update any related records (balances, etc.)
  }

  private async validatePaymentAmount(
    amount: number,
    paymentType: any,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    switch (paymentType.amountType) {
      case PaymentAmountType.FIXED:
        if (amount !== paymentType.amount) {
          throw new BadRequestException(
            `Payment amount must be exactly ${paymentType.amount}`,
          );
        }
        break;

      case PaymentAmountType.PARTIAL_ALLOWED:
        if (paymentType.allowPartialPayment) {
          if (paymentType.minimumAmount && amount < paymentType.minimumAmount) {
            throw new BadRequestException(
              `Payment amount must be at least ${paymentType.minimumAmount}`,
            );
          }
          if (amount > paymentType.amount) {
            throw new BadRequestException(
              `Payment amount cannot exceed ${paymentType.amount}`,
            );
          }
        } else {
          if (amount !== paymentType.amount) {
            throw new BadRequestException(
              `Payment amount must be exactly ${paymentType.amount}`,
            );
          }
        }
        break;

      case PaymentAmountType.FLEXIBLE:
        // Any positive amount is allowed for flexible payment types
        break;
    }
  }

  private mapToResponseDto(payment: any): PaymentResponseDto {
    return {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      description: payment.description,
      dueDate: payment.dueDate,
      paymentType: payment.paymentType,
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference,
      sender: payment.sender,
      cooperative: payment.cooperative,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
