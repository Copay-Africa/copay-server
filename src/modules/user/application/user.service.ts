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
  CooperativeRoomDto,
} from '../presentation/dto/current-user-response.dto';
import { UpdateTenantDto } from '../presentation/dto/update-tenant.dto';
import { CreateTenantDto } from '../presentation/dto/create-tenant.dto';
import { TenantFilterDto } from '../presentation/dto/tenant-filter.dto';
import { TenantDetailResponseDto } from '../presentation/dto/tenant-detail-response.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { UserRole, UserStatus } from '@prisma/client';
import { EnhancedCacheService } from '../../../shared/services/enhanced-cache.service';
import { SmsService } from '../../sms/application/sms.service';
import { ApproveTenantDto } from '../presentation/dto/approve-tenant.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    private prismaService: PrismaService,
    private cacheService: EnhancedCacheService,
    private smsService: SmsService,
  ) {}

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
    // Try to get from cache first
    const cacheKey = `user:${id}:${currentCooperativeId || 'all'}`;
    const cachedUser = await this.cacheService.get<UserResponseDto>(
      cacheKey,
      'user',
    );

    if (cachedUser) {
      return cachedUser;
    }

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

    const userResponse: UserResponseDto = {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      email: user.email || undefined,
      role: user.role,
      status: user.status,
      cooperativeId: user.cooperativeId || undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Cache the response for 5 minutes
    await this.cacheService.set(cacheKey, userResponse, {
      prefix: 'user',
      ttl: 300,
      tags: [`user:${id}`, `cooperative:${user.cooperativeId}`],
    });

    return userResponse;
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserResponseDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user is being set to INACTIVE or SUSPENDED, end their active room assignments
    if (status === UserStatus.INACTIVE || status === UserStatus.SUSPENDED) {
      await this.prismaService.userCooperativeRoom.updateMany({
        where: {
          userId: id,
          isActive: true,
        },
        data: {
          isActive: false,
          endDate: new Date(),
          notes: `User status changed to ${status} - room assignment ended automatically`,
        },
      });
    }

    const updatedUser = await this.prismaService.user.update({
      where: { id },
      data: { status },
      include: { cooperative: true },
    });

    // Invalidate cache for this user
    await this.cacheService.invalidateByTags([`user:${id}`]);

    return this.mapToResponseDto(updatedUser);
  }

  /**
   * Generates a random 4-digit PIN
   */
  private generateRandomPin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Approve or reject a tenant with SMS notifications and PIN generation
   */
  async approveTenant(
    id: string,
    approveTenantDto: ApproveTenantDto,
  ): Promise<UserResponseDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      include: { cooperative: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'TENANT') {
      throw new ForbiddenException('This action can only be performed on tenants');
    }

    // Check if tenant is in PENDING status
    if (user.status !== UserStatus.PENDING) {
      throw new ForbiddenException('Only pending tenants can be approved or rejected');
    }

    let updatedUser;
    
    if (approveTenantDto.status === UserStatus.ACTIVE) {
      // Approval flow: Generate new PIN and send SMS with credentials
      const newPin = this.generateRandomPin();
      const hashedPin = await bcrypt.hash(newPin, 12);

      updatedUser = await this.prismaService.user.update({
        where: { id },
        data: { 
          status: UserStatus.ACTIVE,
          pin: hashedPin,
        },
        include: { cooperative: true },
      });

      // Send approval SMS with credentials
      try {
        const approvalMessage = `Congratulations ${user.firstName}! Your COPAY account has been APPROVED. Your login PIN is: ${newPin}. Please change this PIN after your first login for security. Welcome to ${user.cooperative?.name || 'COPAY'}!`;
        
        await this.smsService.sendSms(user.phone, approvalMessage);
      } catch (smsError) {
        console.error('Failed to send approval SMS:', smsError);
        // Continue with approval even if SMS fails
      }
    } else {
      // Rejection flow: Update status and send rejection SMS
      // If user is being rejected (typically INACTIVE or SUSPENDED), end any room assignments
      if (approveTenantDto.status === UserStatus.INACTIVE || approveTenantDto.status === UserStatus.SUSPENDED) {
        await this.prismaService.userCooperativeRoom.updateMany({
          where: {
            userId: id,
            isActive: true,
          },
          data: {
            isActive: false,
            endDate: new Date(),
            notes: `Tenant application rejected - room assignment ended automatically`,
          },
        });
      }

      updatedUser = await this.prismaService.user.update({
        where: { id },
        data: { 
          status: approveTenantDto.status,
        },
        include: { cooperative: true },
      });

      // Send rejection SMS
      try {
        const rejectionMessage = `Hello ${user.firstName}, unfortunately your COPAY account application has been rejected. ${approveTenantDto.rejectionReason ? `Reason: ${approveTenantDto.rejectionReason}` : ''} Please contact support for more information.`;
        
        await this.smsService.sendSms(user.phone, rejectionMessage);
      } catch (smsError) {
        console.error('Failed to send rejection SMS:', smsError);
        // Continue with rejection even if SMS fails
      }
    }

    // Invalidate cache for this user
    await this.cacheService.invalidateByTags([`user:${id}`]);

    return this.mapToResponseDto(updatedUser);
  }

  async getCurrentUser(userId: string): Promise<CurrentUserResponseDto> {
    // Try cache first
    const cacheKey = `current-user:${userId}`;
    const cachedUser = await this.cacheService.get<CurrentUserResponseDto>(
      cacheKey,
      'user',
    );

    if (cachedUser) {
      return cachedUser;
    }

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

    // Get all cooperatives the user belongs to with rooms
    const userCooperatives = await this.getUserCooperatives(userId);

    const result = this.mapToCurrentUserResponseDto(user, userCooperatives);

    // Cache for 2 minutes (user data changes frequently)
    await this.cacheService.set(cacheKey, result, {
      prefix: 'user',
      ttl: 120,
      tags: [`user:${userId}`, `user-cooperatives:${userId}`],
    });

    return result;
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
          // Cooperatives where user has room assignments
          {
            userCooperativeRooms: {
              some: {
                userId: userId,
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
        rooms: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            floor: true,
            block: true,
            status: true,
            baseRent: true,
            deposit: true,
            userCooperativeRooms: {
              where: {
                userId: userId,
                isActive: true,
              },
              select: {
                startDate: true,
              },
            },
          },
        },
      },
      distinct: ['id'],
    });

    return cooperatives.map((coop) => ({
      id: coop.id,
      name: coop.name,
      code: coop.code,
      status: coop.status as any,
      rooms: coop.rooms.map(
        (room): CooperativeRoomDto => ({
          id: room.id,
          roomNumber: room.roomNumber,
          roomType: room.roomType ?? undefined,
          floor: room.floor ?? undefined,
          block: room.block ?? undefined,
          status: room.status,
          baseRent: room.baseRent ?? undefined,
          deposit: room.deposit ?? undefined,
          isUserAssigned: room.userCooperativeRooms.length > 0,
          assignmentStartDate: room.userCooperativeRooms[0]?.startDate,
        }),
      ),
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

  async deleteUser(id: string): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has payments (soft delete recommended)
    const paymentCount = await this.prismaService.payment.count({
      where: { senderId: id },
    });

    if (paymentCount > 0) {
      // Soft delete by setting status to INACTIVE
      // First, handle room assignments - end any active room assignments
      await this.prismaService.userCooperativeRoom.updateMany({
        where: {
          userId: id,
          isActive: true,
        },
        data: {
          isActive: false,
          endDate: new Date(),
          notes: 'User deleted - room assignment ended automatically',
        },
      });

      await this.prismaService.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE },
      });
    } else {
      // Hard delete if no payments - need to delete all related records first
      await this.prismaService.$transaction(async (tx) => {
        // 1. Delete all room assignments
        await tx.userCooperativeRoom.deleteMany({
          where: { userId: id },
        });

        // 2. Delete notifications
        await tx.notification.deleteMany({
          where: { userId: id },
        });

        // 3. Delete reminders
        await tx.reminder.deleteMany({
          where: { userId: id },
        });

        // 4. Delete activities
        await tx.activity.deleteMany({
          where: { userId: id },
        });

        // 5. Delete complaints
        await tx.complaint.deleteMany({
          where: { userId: id },
        });

        // 6. Update account requests to remove user reference (both userId and processedBy)
        await tx.accountRequest.updateMany({
          where: { 
            OR: [
              { userId: id },
              { processedBy: id }
            ]
          },
          data: { 
            userId: null,
            processedBy: null 
          },
        });

        // 7. Update balance transactions to remove processedBy reference
        await tx.balanceTransaction.updateMany({
          where: {
            OR: [
              { processedBy: id },
              { approvedBy: id }
            ]
          },
          data: {
            processedBy: null,
            approvedBy: null
          },
        });

        // 8. Finally, delete the user
        await tx.user.delete({
          where: { id },
        });
      });
    }

    // Invalidate cache for this user
    await this.cacheService.invalidateByTags([`user:${id}`]);
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
        this.prismaService.user.count({
          where: { role: UserRole.ORGANIZATION_ADMIN },
        }),
        this.prismaService.user.count({
          where: { role: UserRole.SUPER_ADMIN },
        }),
        this.prismaService.user.count({ where: { status: UserStatus.ACTIVE } }),
        this.prismaService.user.count({
          where: { status: UserStatus.INACTIVE },
        }),
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

  private mapToCurrentUserResponseDto(
    user: any,
    cooperatives?: CooperativeDetailsDto[],
  ): CurrentUserResponseDto {
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
      cooperatives: cooperatives || [],
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
