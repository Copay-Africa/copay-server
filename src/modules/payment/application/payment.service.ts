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
import { PaymentSearchDto } from '../presentation/dto/payment-search.dto';
import { PaymentWebhookDto } from '../presentation/dto/payment-webhook.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { PaymentStatus, PaymentAmountType, UserRole } from '@prisma/client';
import { PaymentGatewayFactory } from '../infrastructure/payment-gateway.factory';
import { ActivityService } from '../../activity/application/activity.service';
import { NotificationService } from '../../notification/application/notification.service';
import { SmsService } from '../../sms/application/sms.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private paymentGatewayFactory: PaymentGatewayFactory,
    private activityService: ActivityService,
    private notificationService: NotificationService,
    private smsService: SmsService,
  ) {}

  async initiatePayment(
    initiatePaymentDto: InitiatePaymentDto,
    senderId: string,
    targetCooperativeId?: string,
  ): Promise<PaymentResponseDto> {
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

    const cooperativeId = targetCooperativeId || paymentType.cooperativeId;

    const existingPayment = await this.prismaService.payment.findFirst({
      where: {
        idempotencyKey: initiatePaymentDto.idempotencyKey,
      },
    });

    if (existingPayment) {
      return this.findById(existingPayment.id, senderId, cooperativeId);
    }

    const cooperative = await this.prismaService.cooperative.findUnique({
      where: { id: cooperativeId },
    });

    if (!cooperative || cooperative.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cooperative is not available for payments',
      );
    }

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

      // Get user data for invoice creation
      const sender = await this.prismaService.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true, email: true },
      });

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
        callbackUrl: `${process.env.API_BASE_URL}/api/v1/webhooks/payments/irembopay`,
        email: sender?.email || undefined,
        customerName: sender
          ? `${sender.firstName} ${sender.lastName}`.trim()
          : undefined,
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

      const invoiceNumber =
        gatewayResponse.success && gatewayResponse.gatewayReference
          ? gatewayResponse.gatewayReference
          : null; // Only save real invoice numbers from gateway

      await this.prismaService.payment.update({
        where: { id: payment.id },
        data: {
          paymentReference: gatewayResponse.gatewayReference || payment.id,
          invoiceNumber: invoiceNumber, // Save actual invoice number from IremboPay or null
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

      // The invoice number is now always included in the responseDto from mapToResponseDto
      // since we always generate one during payment update

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

  async findOrganizationPayments(
    cooperativeId: string,
    paginationDto: PaginationDto,
    filters: {
      status?: string;
      paymentMethod?: string;
      senderId?: string;
      paymentTypeId?: string;
      fromDate?: string;
      toDate?: string;
    },
    currentUserRole?: UserRole,
  ): Promise<PaginatedResponseDto<PaymentResponseDto>> {
    // Only allow organization admins and super admins
    if (
      currentUserRole !== UserRole.ORGANIZATION_ADMIN &&
      currentUserRole !== UserRole.SUPER_ADMIN
    ) {
      throw new BadRequestException(
        'Insufficient permissions to view organization payments',
      );
    }

    const { page, limit, search, sortBy, sortOrder, skip } = paginationDto;

    // Build where clause
    const where: any = {};

    // Filter by cooperative for org admins
    if (currentUserRole === UserRole.ORGANIZATION_ADMIN) {
      where.cooperativeId = cooperativeId;
    }

    // Apply additional filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters.senderId) {
      where.senderId = filters.senderId;
    }

    if (filters.paymentTypeId) {
      where.paymentTypeId = filters.paymentTypeId;
    }

    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.createdAt.lte = new Date(filters.toDate);
      }
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { paymentReference: { contains: search, mode: 'insensitive' } },
        { sender: { firstName: { contains: search, mode: 'insensitive' } } },
        { sender: { lastName: { contains: search, mode: 'insensitive' } } },
        { sender: { phone: { contains: search, mode: 'insensitive' } } },
        { paymentType: { name: { contains: search, mode: 'insensitive' } } },
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
          transactions: {
            select: {
              id: true,
              status: true,
              gatewayTransactionId: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      }),
      this.prismaService.payment.count({ where }),
    ]);

    const paymentResponses = payments.map((payment) => {
      const response = this.mapToResponseDto(payment);
      // Add latest transaction info
      if (payment.transactions && payment.transactions.length > 0) {
        (response as any).latestTransaction = payment.transactions[0];
      }
      return response;
    });

    return new PaginatedResponseDto(
      paymentResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async findOrganizationPaymentById(
    id: string,
    cooperativeId: string,
    currentUserRole?: UserRole,
  ): Promise<PaymentResponseDto> {
    // Only allow organization admins and super admins
    if (
      currentUserRole !== UserRole.ORGANIZATION_ADMIN &&
      currentUserRole !== UserRole.SUPER_ADMIN
    ) {
      throw new BadRequestException(
        'Insufficient permissions to view organization payment details',
      );
    }

    const payment = await this.prismaService.payment.findUnique({
      where: { id },
      include: {
        paymentType: {
          select: {
            id: true,
            name: true,
            description: true,
            amount: true,
            amountType: true,
          },
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        transactions: {
          select: {
            id: true,
            amount: true,
            status: true,
            paymentMethod: true,
            gatewayTransactionId: true,
            gatewayReference: true,
            gatewayResponse: true,
            processingStartedAt: true,
            processingCompletedAt: true,
            failureReason: true,
            webhookReceived: true,
            webhookReceivedAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check access permissions - org admins can only see payments in their cooperative
    if (
      currentUserRole === UserRole.ORGANIZATION_ADMIN &&
      payment.cooperativeId !== cooperativeId
    ) {
      throw new NotFoundException('Payment not found');
    }

    const response = this.mapToResponseDto(payment);
    // Add transaction details for organization view
    (response as any).transactions = payment.transactions;

    return response;
  }

  async getOrganizationPaymentStats(
    cooperativeId: string,
    filters: {
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<any> {
    const where: any = {
      cooperativeId,
    };

    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.createdAt.lte = new Date(filters.toDate);
      }
    }

    try {
      // Get payment statistics
      const [
        totalPayments,
        totalAmount,
        statusBreakdown,
        methodBreakdown,
        recentPayments,
      ] = await Promise.all([
        // Total count
        this.prismaService.payment.count({ where }),

        // Total amount aggregate
        this.prismaService.payment
          .aggregate({
            where,
            _sum: {
              amount: true,
            },
            _avg: {
              amount: true,
            },
          })
          .catch(() => ({ _sum: { amount: 0 }, _avg: { amount: 0 } })),

        // Status breakdown
        this.prismaService.payment
          .groupBy({
            by: ['status'],
            where,
            _count: {
              status: true,
            },
            _sum: {
              amount: true,
            },
          })
          .catch(() => []),

        // Payment method breakdown - filter out null values
        this.prismaService.payment
          .groupBy({
            by: ['paymentMethod'],
            where: {
              ...where,
              paymentMethod: { not: null },
            },
            _count: {
              paymentMethod: true,
            },
            _sum: {
              amount: true,
            },
          })
          .catch(() => []),

        // Recent payments (last 10)
        this.prismaService.payment
          .findMany({
            where,
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
            include: {
              sender: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
              paymentType: {
                select: {
                  name: true,
                },
              },
            },
          })
          .catch(() => []),
      ]);

      return {
        summary: {
          totalPayments: totalPayments || 0,
          totalAmount: totalAmount?._sum?.amount || 0,
          averageAmount: totalAmount?._avg?.amount || 0,
        },
        statusBreakdown: (statusBreakdown || []).map((item) => ({
          status: item.status,
          count: item._count?.status || 0,
          totalAmount: item._sum?.amount || 0,
        })),
        methodBreakdown: (methodBreakdown || []).map((item) => ({
          method: item.paymentMethod,
          count: item._count?.paymentMethod || 0,
          totalAmount: item._sum?.amount || 0,
        })),
        recentPayments: (recentPayments || []).map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          paymentType: payment.paymentType?.name || 'Unknown',
          sender:
            `${payment.sender?.firstName || ''} ${payment.sender?.lastName || ''}`.trim() ||
            'Unknown',
          senderPhone: payment.sender?.phone || '',
          createdAt: payment.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error('Error getting organization payment stats:', error);
      // Return empty stats on error
      return {
        summary: {
          totalPayments: 0,
          totalAmount: 0,
          averageAmount: 0,
        },
        statusBreakdown: [],
        methodBreakdown: [],
        recentPayments: [],
      };
    }
  }

  async handleWebhook(webhookDto: PaymentWebhookDto): Promise<void> {
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
  }
  async searchPayments(
    searchDto: PaymentSearchDto,
    userId: string,
    userCooperativeId: string,
    userRole: UserRole,
  ): Promise<PaginatedResponseDto<PaymentResponseDto>> {
    try {
      // Input validation
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      if (userRole === UserRole.ORGANIZATION_ADMIN && !userCooperativeId) {
        throw new BadRequestException(
          'Cooperative ID is required for organization admin',
        );
      }

      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = searchDto;
      const skip = (page - 1) * limit;

      // Build where clause based on user role and search criteria
      const whereClause: any = {};

      // Role-based access control
      if (userRole === UserRole.TENANT) {
        whereClause.senderId = userId;
      } else if (userRole === UserRole.ORGANIZATION_ADMIN) {
        whereClause.cooperativeId = userCooperativeId;
      } else if (userRole === UserRole.SUPER_ADMIN) {
        // Super admin can search across all cooperatives
        if (searchDto.cooperativeId) {
          whereClause.cooperativeId = searchDto.cooperativeId;
        }
      }

      // Apply search filters
      if (searchDto.search) {
        whereClause.OR = [
          { description: { contains: searchDto.search, mode: 'insensitive' } },
          {
            paymentReference: {
              contains: searchDto.search,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (searchDto.status) {
        whereClause.status = searchDto.status;
      }

      if (searchDto.paymentMethod) {
        whereClause.paymentMethod = searchDto.paymentMethod;
      }

      if (searchDto.paymentTypeId) {
        whereClause.paymentTypeId = searchDto.paymentTypeId;
      }

      if (searchDto.senderId) {
        whereClause.senderId = searchDto.senderId;
      }

      // Amount range filtering
      if (
        searchDto.minAmount !== undefined ||
        searchDto.maxAmount !== undefined
      ) {
        whereClause.amount = {};
        if (searchDto.minAmount !== undefined) {
          whereClause.amount.gte = searchDto.minAmount;
        }
        if (searchDto.maxAmount !== undefined) {
          whereClause.amount.lte = searchDto.maxAmount;
        }
      }

      // Date range filtering (created date)
      if (searchDto.fromDate || searchDto.toDate) {
        whereClause.createdAt = {};
        if (searchDto.fromDate) {
          whereClause.createdAt.gte = new Date(searchDto.fromDate);
        }
        if (searchDto.toDate) {
          whereClause.createdAt.lte = new Date(searchDto.toDate);
        }
      }

      // Date range filtering (paid date)
      if (searchDto.paidFromDate || searchDto.paidToDate) {
        whereClause.paidAt = {};
        if (searchDto.paidFromDate) {
          whereClause.paidAt.gte = new Date(searchDto.paidFromDate);
        }
        if (searchDto.paidToDate) {
          whereClause.paidAt.lte = new Date(searchDto.paidToDate);
        }
      }

      // Build sort clause
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      const [payments, total] = await Promise.all([
        this.prismaService.payment.findMany({
          where: whereClause,
          include: {
            paymentType: true,
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
          skip,
          take: limit,
          orderBy,
        }),
        this.prismaService.payment.count({ where: whereClause }),
      ]);

      const data = payments.map((payment) => this.mapToResponseDto(payment));

      return new PaginatedResponseDto(data, total, page, limit);
    } catch (error) {
      this.logger.error('Error searching payments:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to search payments');
    }
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    failureReason?: string,
    gatewayData?: Record<string, any>,
  ): Promise<void> {
    try {
      // Find the payment
      const payment = await this.prismaService.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // Update payment status
      const updateData: {
        status: PaymentStatus;
        updatedAt: Date;
        paidAt?: Date;
        gatewayResponse?: any;
      } = {
        status: status,
        updatedAt: new Date(),
      };

      if (status === PaymentStatus.COMPLETED) {
        updateData.paidAt = new Date();
      }

      if (failureReason && status === PaymentStatus.FAILED) {
        const existingGatewayResponse =
          (payment.gatewayResponse as Record<string, any>) || {};
        updateData.gatewayResponse = {
          ...existingGatewayResponse,
          failureReason,
          ...(gatewayData || {}),
        };
      }

      await this.prismaService.payment.update({
        where: { id: paymentId },
        data: updateData,
      });

      this.logger.log(`Payment ${paymentId} status updated to ${status}`);
    } catch (error) {
      this.logger.error(
        `Failed to update payment status: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async validatePaymentAmount(amount: number, paymentType: any): Promise<void> {
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
      invoiceNumber: payment.invoiceNumber,
      sender: payment.sender,
      cooperative: payment.cooperative,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  async handleIremboPayWebhook(
    invoiceNumber: string,
    webhookDto: PaymentWebhookDto,
    amount: number,
    paidAt?: string,
  ): Promise<void> {
    try {
      // Find payment by invoice number
      const payment = await this.prismaService.payment.findFirst({
        where: { invoiceNumber: invoiceNumber },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          paymentType: {
            select: {
              name: true,
              description: true,
            },
          },
          cooperative: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!payment) {
        this.logger.warn(
          `Payment with invoice number ${invoiceNumber} not found`,
        );
        throw new NotFoundException(
          `Payment with invoice number ${invoiceNumber} not found`,
        );
      }

      // Update payment with webhook data
      const updateData: {
        status: PaymentStatus;
        updatedAt: Date;
        paidAt?: Date;
        gatewayResponse?: any;
        gatewayTransactionId?: string;
        paymentReference?: string;
      } = {
        status: webhookDto.status,
        updatedAt: new Date(),
      };

      this.logger.log(
        `Webhook processing - Mapping status: IremboPay="${webhookDto.gatewayData?.paymentStatus}" -> System="${webhookDto.status}"`,
      );

      if (webhookDto.status === PaymentStatus.COMPLETED && paidAt) {
        const parsedDate = this.parseWebhookDate(paidAt);
        if (parsedDate) {
          updateData.paidAt = parsedDate;
        }
      }

      if (webhookDto.gatewayTransactionId) {
        updateData.gatewayTransactionId = webhookDto.gatewayTransactionId;
      }

      if (webhookDto.gatewayReference) {
        updateData.paymentReference = webhookDto.gatewayReference;
      }

      if (webhookDto.gatewayData) {
        updateData.gatewayResponse = webhookDto.gatewayData;
      }

      await this.prismaService.payment.update({
        where: { id: payment.id },
        data: updateData,
      });

      this.logger.log(
        `Payment update completed - ID: ${payment.id}, Status set to: ${updateData.status}`,
      );

      this.logger.log(
        `Payment ${payment.id} updated via IremboPay webhook - Status: ${webhookDto.status}, Invoice: ${invoiceNumber}`,
      );

      // Send notifications and SMS to the user
      await this.sendPaymentNotifications(payment, webhookDto.status, amount);

      // Log activity for payment status change
      if (webhookDto.status === PaymentStatus.COMPLETED) {
        await this.activityService.logPaymentCompleted(payment.id, amount, {
          userId: payment.senderId,
          cooperativeId: payment.cooperativeId,
        });
      } else if (webhookDto.status === PaymentStatus.FAILED) {
        await this.activityService.logPaymentFailed(
          payment.id,
          amount,
          webhookDto.failureReason || 'Payment failed',
          { userId: payment.senderId, cooperativeId: payment.cooperativeId },
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process IremboPay webhook for invoice ${invoiceNumber}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async sendPaymentNotifications(
    payment: any,
    status: PaymentStatus,
    amount: number,
  ): Promise<void> {
    try {
      const { sender, paymentType } = payment;

      if (!sender) {
        this.logger.warn(`No sender found for payment ${payment.id}`);
        return;
      }

      const formatAmount = (amount: number): string => {
        return new Intl.NumberFormat('en-RW', {
          style: 'currency',
          currency: 'RWF',
          minimumFractionDigits: 0,
        }).format(amount);
      };

      if (status === PaymentStatus.COMPLETED) {
        // Payment successful notifications
        const successMessage = `Great news! Your payment of ${formatAmount(amount)} for ${paymentType?.name || 'payment'} has been successfully processed. Transaction completed on ${new Date().toLocaleDateString('en-RW')}.`;

        // Send push notification
        if (sender.id) {
          await this.notificationService.sendPaymentNotification(
            payment,
            sender,
            'PUSH_NOTIFICATION' as any,
            'Payment Successful! 🎉',
            successMessage,
          );
        }

        // Send SMS notification
        if (sender.phone) {
          const smsMessage = `COPAY: Payment successful! ${formatAmount(amount)} for ${paymentType?.name || 'payment'} has been processed. Thank you for using Copay.`;

          await this.smsService.sendSms(
            sender.phone,
            smsMessage,
            `payment-success-${payment.id}`,
          );
        }

        this.logger.log(
          `Success notifications sent to user ${sender.id} for payment ${payment.id}`,
        );
      } else if (status === PaymentStatus.FAILED) {
        // Payment failed notifications
        const failureMessage = `Your payment of ${formatAmount(amount)} for ${paymentType?.name || 'payment'} could not be processed. Please try again or contact support if the issue persists.`;

        // Send push notification
        if (sender.id) {
          await this.notificationService.sendPaymentNotification(
            payment,
            sender,
            'PUSH_NOTIFICATION' as any,
            'Payment Failed ❌',
            failureMessage,
          );
        }

        // Send SMS notification
        if (sender.phone) {
          const smsMessage = `COPAY: Payment failed. ${formatAmount(amount)} for ${paymentType?.name || 'payment'} could not be processed. Please try again.`;

          await this.smsService.sendSms(
            sender.phone,
            smsMessage,
            `payment-failure-${payment.id}`,
          );
        }

        this.logger.log(
          `Failure notifications sent to user ${sender.id} for payment ${payment.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send notifications for payment ${payment.id}: ${(error as Error).message}`,
      );
      // Don't throw error here - notifications are not critical to payment processing
    }
  }

  /**
   * Parse date from webhook payload with fallback handling
   */
  private parseWebhookDate(dateString: string): Date | null {
    try {
      // Try parsing the date string directly
      const date = new Date(dateString);

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        this.logger.warn(`Invalid date format received: ${dateString}`);
        return null;
      }

      return date;
    } catch (error) {
      this.logger.error(
        `Failed to parse date ${dateString}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
