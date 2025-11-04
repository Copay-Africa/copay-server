import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserDto } from '../presentation/dto/create-user.dto';
import { UserResponseDto } from '../presentation/dto/user-response.dto';
import {
  CurrentUserResponseDto,
  CooperativeDetailsDto,
} from '../presentation/dto/current-user-response.dto';
import { UpdateTenantDto } from '../presentation/dto/update-tenant.dto';
import { CreateTenantDto } from '../presentation/dto/create-tenant.dto';
import { TenantFilterDto } from '../presentation/dto/tenant-filter.dto';
import { TenantDetailResponseDto } from '../presentation/dto/tenant-detail-response.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private prismaService: PrismaService) {}

  async create(
    createUserDto: CreateUserDto,
    currentUserId?: string,
  ): Promise<UserResponseDto> {
    // Check if phone number already exists
    const existingUser = await this.prismaService.user.findUnique({
      where: { phone: createUserDto.phone },
    });

    if (existingUser) {
      throw new ConflictException('Phone number already registered');
    }

    // Hash the PIN
    const hashedPin = await bcrypt.hash(createUserDto.pin, 12);

    // Validate cooperative assignment
    if (createUserDto.cooperativeId) {
      const cooperative = await this.prismaService.cooperative.findUnique({
        where: { id: createUserDto.cooperativeId },
      });

      if (!cooperative) {
        throw new NotFoundException('Cooperative not found');
      }
    }

    // Create user
    const user = await this.prismaService.user.create({
      data: {
        ...createUserDto,
        pin: hashedPin,
        status: UserStatus.ACTIVE, // Auto-activate for now
      },
    });

    return this.mapToResponseDto(user);
  }

  async findAll(
    paginationDto: PaginationDto,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const { page, limit, search, sortBy, sortOrder, skip } = paginationDto;

    // Build where clause based on user role and search
    const where: any = {};

    // Apply tenant isolation for non-super admins
    if (currentUserRole !== UserRole.SUPER_ADMIN && currentCooperativeId) {
      where.cooperativeId = currentCooperativeId;
    }

    // Add search filter
    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
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
    const [users, total] = await Promise.all([
      this.prismaService.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { cooperative: true },
      }),
      this.prismaService.user.count({ where }),
    ]);

    const userResponses = users.map((user) => this.mapToResponseDto(user));

    return new PaginatedResponseDto(
      userResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async findOne(
    id: string,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<UserResponseDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      include: { cooperative: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      user.cooperativeId !== currentCooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapToResponseDto(user);
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserResponseDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prismaService.user.update({
      where: { id },
      data: { status },
      include: { cooperative: true },
    });

    return this.mapToResponseDto(updatedUser);
  }

  async getCurrentUser(userId: string): Promise<CurrentUserResponseDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('User account is not active');
    }

    return this.mapToCurrentUserResponseDto(user);
  }

  async getUserCooperatives(userId: string): Promise<CooperativeDetailsDto[]> {
    // Get all cooperatives where the user has made payments or has access
    const cooperatives = await this.prismaService.cooperative.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          // Cooperatives where user has made payments
          {
            payments: {
              some: {
                senderId: userId,
              },
            },
          },
          // Cooperatives where user is assigned (backward compatibility)
          {
            users: {
              some: {
                id: userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
      },
      distinct: ['id'],
    });

    return cooperatives.map((coop) => ({
      id: coop.id,
      name: coop.name,
      code: coop.code,
      status: coop.status as any,
    }));
  }

  // Super Admin Tenant Management Methods
  async createTenant(
    createTenantDto: CreateTenantDto,
  ): Promise<TenantDetailResponseDto> {
    // Check if phone number already exists
    const existingUser = await this.prismaService.user.findUnique({
      where: { phone: createTenantDto.phone },
    });

    if (existingUser) {
      throw new ConflictException('Phone number already registered');
    }

    // Validate cooperative exists
    const cooperative = await this.prismaService.cooperative.findUnique({
      where: { id: createTenantDto.cooperativeId },
    });

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    // Hash the PIN
    const hashedPin = await bcrypt.hash(createTenantDto.pin, 12);

    // Create tenant
    const tenant = await this.prismaService.user.create({
      data: {
        phone: createTenantDto.phone,
        pin: hashedPin,
        firstName: createTenantDto.firstName,
        lastName: createTenantDto.lastName,
        email: createTenantDto.email,
        role: UserRole.TENANT,
        status: UserStatus.ACTIVE,
        cooperativeId: createTenantDto.cooperativeId,
      },
      include: {
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
    });

    return await this.mapToTenantDetailDto(tenant);
  }

  async getAllTenants(
    filterDto: TenantFilterDto,
  ): Promise<PaginatedResponseDto<TenantDetailResponseDto>> {
    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      skip,
      status,
      cooperativeId,
      role,
      dateFrom,
      dateTo,
    } = filterDto;

    // Build where clause
    const where: any = {
      role: role || UserRole.TENANT, // Default to tenants only
    };

    // Add filters
    if (status) {
      where.status = status;
    }

    if (cooperativeId) {
      where.cooperativeId = cooperativeId;
    }

    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
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
    const [tenants, total] = await Promise.all([
      this.prismaService.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          cooperative: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
            },
          },
        },
      }),
      this.prismaService.user.count({ where }),
    ]);

    const tenantResponses = await Promise.all(
      tenants.map(async (tenant) => await this.mapToTenantDetailDto(tenant)),
    );

    return new PaginatedResponseDto(
      tenantResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async getTenantById(id: string): Promise<TenantDetailResponseDto> {
    const tenant = await this.prismaService.user.findUnique({
      where: { id },
      include: {
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return await this.mapToTenantDetailDto(tenant);
  }

  async updateTenant(
    id: string,
    updateTenantDto: UpdateTenantDto,
  ): Promise<TenantDetailResponseDto> {
    const tenant = await this.prismaService.user.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Validate cooperative if provided
    if (updateTenantDto.cooperativeId) {
      const cooperative = await this.prismaService.cooperative.findUnique({
        where: { id: updateTenantDto.cooperativeId },
      });

      if (!cooperative) {
        throw new NotFoundException('Cooperative not found');
      }
    }

    // Prepare update data
    const updateData: any = {
      firstName: updateTenantDto.firstName,
      lastName: updateTenantDto.lastName,
      email: updateTenantDto.email,
      status: updateTenantDto.status,
      cooperativeId: updateTenantDto.cooperativeId,
    };

    // Hash new PIN if provided
    if (updateTenantDto.pin) {
      updateData.pin = await bcrypt.hash(updateTenantDto.pin, 12);
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updatedTenant = await this.prismaService.user.update({
      where: { id },
      data: updateData,
      include: {
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
    });

    return await this.mapToTenantDetailDto(updatedTenant);
  }

  async deleteTenant(id: string): Promise<void> {
    const tenant = await this.prismaService.user.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check if tenant has payments (soft delete recommended)
    const paymentCount = await this.prismaService.payment.count({
      where: { senderId: id },
    });

    if (paymentCount > 0) {
      // Soft delete by setting status to INACTIVE
      await this.prismaService.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE },
      });
    } else {
      // Hard delete if no payments
      await this.prismaService.user.delete({
        where: { id },
      });
    }
  }

  async getTenantStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byCooperative: Array<{
      cooperativeId: string;
      cooperativeName: string;
      count: number;
    }>;
    recentRegistrations: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const [total, active, inactive, byCooperative, recentRegistrations] =
        await Promise.all([
          // Total tenants
          this.prismaService.user.count({
            where: { role: UserRole.TENANT },
          }),
          // Active tenants
          this.prismaService.user.count({
            where: {
              role: UserRole.TENANT,
              status: UserStatus.ACTIVE,
            },
          }),
          // Inactive tenants
          this.prismaService.user.count({
            where: {
              role: UserRole.TENANT,
              status: UserStatus.INACTIVE,
            },
          }),
          // By cooperative
          this.prismaService.user.groupBy({
            by: ['cooperativeId'],
            where: { role: UserRole.TENANT },
            _count: true,
          }),
          // Recent registrations (last 30 days)
          this.prismaService.user.count({
            where: {
              role: UserRole.TENANT,
              createdAt: {
                gte: thirtyDaysAgo,
              },
            },
          }),
        ]);

      // Enrich cooperative data
      const cooperativeIds = byCooperative
        .filter((item) => item.cooperativeId)
        .map((item) => item.cooperativeId!);

      const cooperatives = await this.prismaService.cooperative.findMany({
        where: { id: { in: cooperativeIds } },
        select: { id: true, name: true },
      });

      const cooperativeMap = new Map(cooperatives.map((c) => [c.id, c.name]));

      const enrichedByCooperative = byCooperative
        .filter((item) => item.cooperativeId)
        .map((item) => ({
          cooperativeId: item.cooperativeId!,
          cooperativeName: cooperativeMap.get(item.cooperativeId!) || 'Unknown',
          count: item._count,
        }));

      return {
        total,
        active,
        inactive,
        byCooperative: enrichedByCooperative,
        recentRegistrations,
      };
    } catch (error) {
      console.error('Error getting tenant stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        byCooperative: [],
        recentRegistrations: 0,
      };
    }
  }

  private async mapToTenantDetailDto(
    tenant: any,
  ): Promise<TenantDetailResponseDto> {
    // Get additional tenant stats
    const [paymentStats, complaintStats] = await Promise.all([
      // Payment statistics
      this.prismaService.payment.aggregate({
        where: { senderId: tenant.id },
        _count: true,
        _sum: { amount: true },
        _max: { createdAt: true },
      }),
      // Active complaints count
      this.prismaService.complaint.count({
        where: {
          userId: tenant.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
    ]);

    return {
      id: tenant.id,
      phone: tenant.phone,
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      email: tenant.email,
      role: tenant.role,
      status: tenant.status,
      cooperativeId: tenant.cooperativeId,
      cooperative: tenant.cooperative
        ? {
            id: tenant.cooperative.id,
            name: tenant.cooperative.name,
            code: tenant.cooperative.code,
            status: tenant.cooperative.status,
          }
        : undefined,
      lastLoginAt: tenant.lastLoginAt,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      totalPayments: paymentStats._count || 0,
      totalPaymentAmount: paymentStats._sum.amount
        ? Number(paymentStats._sum.amount)
        : 0,
      lastPaymentAt: paymentStats._max.createdAt || undefined,
      activeComplaints: complaintStats || 0,
    };
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    totalTenants: number;
    totalOrgAdmins: number;
    totalSuperAdmins: number;
    activeUsers: number;
    inactiveUsers: number;
    recentRegistrations: number;
  }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalUsers,
        totalTenants,
        totalOrgAdmins,
        totalSuperAdmins,
        activeUsers,
        inactiveUsers,
        recentRegistrations,
      ] = await Promise.all([
        this.prismaService.user.count(),
        this.prismaService.user.count({ where: { role: UserRole.TENANT } }),
        this.prismaService.user.count({ where: { role: UserRole.ORGANIZATION_ADMIN } }),
        this.prismaService.user.count({ where: { role: UserRole.SUPER_ADMIN } }),
        this.prismaService.user.count({ where: { status: UserStatus.ACTIVE } }),
        this.prismaService.user.count({ where: { status: UserStatus.INACTIVE } }),
        this.prismaService.user.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);

      return {
        totalUsers,
        totalTenants,
        totalOrgAdmins,
        totalSuperAdmins,
        activeUsers,
        inactiveUsers,
        recentRegistrations,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw new Error('Failed to get user statistics');
    }
  }

  private mapToResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      cooperativeId: user.cooperativeId,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private mapToCurrentUserResponseDto(user: any): CurrentUserResponseDto {
    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      cooperative: user.cooperative
        ? {
            id: user.cooperative.id,
            name: user.cooperative.name,
            code: user.cooperative.code,
            status: user.cooperative.status,
          }
        : undefined,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
