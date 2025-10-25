import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentTypeDto } from '../presentation/dto/create-payment-type.dto';
import { PaymentTypeResponseDto } from '../presentation/dto/payment-type-response.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { UserRole } from '@prisma/client';
import { PaymentCacheService } from '../infrastructure/payment-cache.service';

@Injectable()
export class PaymentTypeService {
  constructor(
    private prismaService: PrismaService,
    private paymentCacheService: PaymentCacheService,
  ) {}

  async create(
    createPaymentTypeDto: CreatePaymentTypeDto,
    cooperativeId: string,
    currentUserRole: UserRole,
  ): Promise<PaymentTypeResponseDto> {
    // Only Organization Admins and Super Admins can create payment types
    if (currentUserRole === UserRole.TENANT) {
      throw new ForbiddenException('Tenants cannot create payment types');
    }

    // Validate minimum amount for partial payments
    if (
      createPaymentTypeDto.allowPartialPayment &&
      createPaymentTypeDto.minimumAmount &&
      createPaymentTypeDto.minimumAmount >= createPaymentTypeDto.amount
    ) {
      throw new BadRequestException(
        'Minimum amount must be less than the base amount',
      );
    }

    // Check if payment type name already exists in this cooperative
    const existingPaymentType = await this.prismaService.paymentType.findFirst({
      where: {
        cooperativeId,
        name: createPaymentTypeDto.name,
      },
    });

    if (existingPaymentType) {
      throw new ConflictException(
        'Payment type with this name already exists in the cooperative',
      );
    }

    // Create payment type
    const paymentType = await this.prismaService.paymentType.create({
      data: {
        ...createPaymentTypeDto,
        cooperativeId,
      },
    });

    // Clear cache for this cooperative's payment types
    await this.paymentCacheService.invalidateCooperativePaymentTypes(
      cooperativeId,
    );

    return this.mapToResponseDto(paymentType);
  }

  async findAllByCooperative(
    cooperativeId: string,
    paginationDto: PaginationDto,
    includeInactive = false,
  ): Promise<PaginatedResponseDto<PaymentTypeResponseDto>> {
    const { page, limit, search, sortBy, sortOrder, skip } = paginationDto;

    // Try to get from cache first for active payment types
    if (!includeInactive && !search) {
      const cached =
        await this.paymentCacheService.getCooperativePaymentTypes(
          cooperativeId,
        );
      if (cached) {
        // Apply pagination to cached results
        const startIndex = ((page || 1) - 1) * (limit || 10);
        const endIndex = startIndex + (limit || 10);
        const paginatedData = cached.slice(startIndex, endIndex);

        return new PaginatedResponseDto(
          paginatedData.map((pt) => new PaymentTypeResponseDto(pt)),
          cached.length,
          page || 1,
          limit || 10,
        );
      }
    }

    // Build where clause
    const where: any = {
      cooperativeId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
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
    const [paymentTypes, total] = await Promise.all([
      this.prismaService.paymentType.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prismaService.paymentType.count({ where }),
    ]);

    const paymentTypeResponses = paymentTypes.map((pt) =>
      this.mapToResponseDto(pt),
    );

    const result = new PaginatedResponseDto(
      paymentTypeResponses,
      total,
      page || 1,
      limit || 10,
    );

    // Cache the active payment types
    if (!includeInactive && !search) {
      await this.paymentCacheService.cacheCooperativePaymentTypes(
        cooperativeId,
        paymentTypes,
        true, // USSD optimized
      );
    }

    return result;
  }

  async findById(
    id: string,
    cooperativeId: string,
    currentUserRole: UserRole,
  ): Promise<PaymentTypeResponseDto> {
    const paymentType = await this.prismaService.paymentType.findUnique({
      where: { id },
    });

    if (!paymentType) {
      throw new NotFoundException('Payment type not found');
    }

    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      paymentType.cooperativeId !== cooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapToResponseDto(paymentType);
  }

  async updateStatus(
    id: string,
    isActive: boolean,
    cooperativeId: string,
    currentUserRole: UserRole,
  ): Promise<PaymentTypeResponseDto> {
    // Only Organization Admins and Super Admins can update payment types
    if (currentUserRole === UserRole.TENANT) {
      throw new ForbiddenException('Tenants cannot update payment types');
    }

    const paymentType = await this.prismaService.paymentType.findUnique({
      where: { id },
    });

    if (!paymentType) {
      throw new NotFoundException('Payment type not found');
    }

    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      paymentType.cooperativeId !== cooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    const updatedPaymentType = await this.prismaService.paymentType.update({
      where: { id },
      data: { isActive },
    });

    // Clear cache for this cooperative's payment types
    await this.paymentCacheService.invalidateCooperativePaymentTypes(
      paymentType.cooperativeId,
    );

    return this.mapToResponseDto(updatedPaymentType);
  }

  async getActivePaymentTypesForCache(
    cooperativeId: string,
  ): Promise<PaymentTypeResponseDto[]> {
    // This method is specifically for USSD and mobile app caching
    const cached =
      await this.paymentCacheService.getActivePaymentTypes(cooperativeId);
    if (cached) {
      return cached.map((pt) => new PaymentTypeResponseDto(pt));
    }

    const paymentTypes = await this.prismaService.paymentType.findMany({
      where: {
        cooperativeId,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const result = paymentTypes.map((pt) => this.mapToResponseDto(pt));

    // Cache for fast USSD access
    await this.paymentCacheService.cacheActivePaymentTypes(
      cooperativeId,
      paymentTypes,
    );

    return result;
  }

  async findByIdPublic(
    id: string,
    cooperativeId?: string,
  ): Promise<PaymentTypeResponseDto> {
    const paymentType = await this.prismaService.paymentType.findUnique({
      where: { id },
    });

    if (!paymentType) {
      throw new NotFoundException('Payment type not found');
    }

    // If cooperativeId is provided, validate it matches
    if (cooperativeId && paymentType.cooperativeId !== cooperativeId) {
      throw new NotFoundException(
        'Payment type not found in specified cooperative',
      );
    }

    return this.mapToResponseDto(paymentType);
  }

  private async clearPaymentTypesCache(cooperativeId: string): Promise<void> {
    // Use the new cache service for invalidation
    await this.paymentCacheService.invalidateCooperativePaymentTypes(
      cooperativeId,
    );
  }

  private mapToResponseDto(paymentType: any): PaymentTypeResponseDto {
    return {
      id: paymentType.id,
      name: paymentType.name,
      description: paymentType.description,
      amount: paymentType.amount,
      amountType: paymentType.amountType,
      isActive: paymentType.isActive,
      allowPartialPayment: paymentType.allowPartialPayment,
      minimumAmount: paymentType.minimumAmount,
      dueDay: paymentType.dueDay,
      isRecurring: paymentType.isRecurring,
      cooperativeId: paymentType.cooperativeId,
      settings: paymentType.settings,
      createdAt: paymentType.createdAt,
      updatedAt: paymentType.updatedAt,
    };
  }
}
