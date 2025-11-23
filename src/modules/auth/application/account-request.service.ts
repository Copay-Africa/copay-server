import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SmsService } from '../../sms/application/sms.service';
import { AccountRequestStatus, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  CreateAccountRequestDto,
  AccountRequestResponseDto,
  ProcessAccountRequestDto,
  AccountRequestStatsDto,
} from '../presentation/dto/account-request.dto';

@Injectable()
export class AccountRequestService {
  private readonly logger = new Logger(AccountRequestService.name);

  constructor(
    private prismaService: PrismaService,
    private smsService: SmsService,
  ) {}

  private get prisma(): any {
    return this.prismaService;
  }

  /**
   * Create a new account request
   */
  async createAccountRequest(
    createAccountRequestDto: CreateAccountRequestDto,
  ): Promise<AccountRequestResponseDto> {
    const { fullName, phone, cooperativeId, roomNumber } =
      createAccountRequestDto;

    this.logger.log(
      `Creating account request - Name: ${fullName}, Phone: ${phone}, Cooperative: ${cooperativeId}, Room: ${roomNumber}`,
    );

    // Check if cooperative exists
    const cooperative = await this.prismaService.cooperative.findUnique({
      where: { id: cooperativeId },
    });

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    // Check if user already exists with this phone number
    const existingUser = await this.prismaService.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this phone number already exists',
      );
    }

    // Debug: Check what account requests exist for this phone
    const allExistingRequests = await this.prismaService.accountRequest.findMany({
      where: { phone },
      select: {
        id: true,
        phone: true,
        status: true,
        userId: true,
        cooperativeId: true,
        cooperative: { select: { name: true } },
      },
    });

    if (allExistingRequests.length > 0) {
      this.logger.debug(
        `Existing account requests for ${phone}: ${JSON.stringify(allExistingRequests)}`,
      );
      
      // Only block if there's an approved request with a userId
      const approvedRequestWithUser = allExistingRequests.find(
        req => req.status === AccountRequestStatus.APPROVED && req.userId
      );
      
      if (approvedRequestWithUser) {
        const cooperativeName = approvedRequestWithUser.cooperative?.name || 'a cooperative';
        this.logger.warn(
          `Blocked duplicate request - Phone: ${phone} already has approved account in ${cooperativeName}, Request ID: ${approvedRequestWithUser.id}, User ID: ${approvedRequestWithUser.userId}`,
        );
        throw new ConflictException(
          `This phone number already has an approved account with ${cooperativeName}. Each phone number can only have one active account.`,
        );
      }
    }

    // CRITICAL CHECK: Look for any account request with userId set to avoid constraint violation
    const requestsWithUserId = await this.prismaService.accountRequest.findMany({
      where: {
        userId: { not: null },
      },
      select: {
        id: true,
        phone: true,
        userId: true,
        status: true,
        cooperative: { select: { name: true } },
      },
    });

    this.logger.debug(
      `All account requests with userId set: ${JSON.stringify(requestsWithUserId)}`,
    );

    // Check if there are any records that might cause constraint issues
    const conflictingUserIds = requestsWithUserId.map(req => req.userId);
    if (conflictingUserIds.length > 0) {
      this.logger.warn(
        `Found ${conflictingUserIds.length} account requests with userId set. This might cause constraint violations.`,
      );
    }

    // Check if there's already a pending request for this phone and cooperative
    const existingRequest = await this.prismaService.accountRequest.findUnique({
      where: {
        phone_cooperativeId: {
          phone,
          cooperativeId,
        },
      },
    });

    if (existingRequest) {
      if (existingRequest.status === AccountRequestStatus.PENDING) {
        // Send SMS notification about existing pending request
        try {
          await this.smsService.sendSms(
            phone,
            `Hello ${fullName}, your account request for ${cooperative.name} is still pending review. We will notify you once it's processed.`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to send SMS for existing pending request: ${error.message}`,
          );
        }
        throw new ConflictException(
          'You already have a pending account request for this cooperative',
        );
      }
      if (existingRequest.status === AccountRequestStatus.APPROVED) {
        throw new ConflictException(
          'Your account request has already been approved',
        );
      }
    }

    // Check if room number is already taken in this cooperative
    const existingRoomRequest =
      await this.prismaService.accountRequest.findFirst({
        where: {
          cooperativeId,
          roomNumber,
          status: {
            in: [AccountRequestStatus.PENDING, AccountRequestStatus.APPROVED],
          },
        },
      });

    if (existingRoomRequest) {
      throw new ConflictException(
        'This room number is already taken or has a pending request',
      );
    }

    // Check if room is already occupied by another user
    // TODO: Implement room validation after fixing Prisma types
    // For now, we'll skip this validation
    const existingUserInRoom = null;

    if (existingUserInRoom) {
      throw new ConflictException('This room number is already occupied');
    }

    // Create the account request using upsert to avoid constraint issues
    try {
      this.logger.log(
        `About to create account request with data: ${JSON.stringify({
          fullName,
          phone,
          cooperativeId,
          roomNumber,
          status: AccountRequestStatus.PENDING
        })}`,
      );
      
      // Use a unique identifier for the where clause that won't conflict
      const uniqueIdentifier = `${phone}_${cooperativeId}_${Date.now()}`;
      
      const accountRequest = await this.prismaService.accountRequest.upsert({
        where: {
          phone_cooperativeId: {
            phone,
            cooperativeId,
          },
        },
        create: {
          fullName,
          phone,
          cooperativeId,
          roomNumber,
          status: AccountRequestStatus.PENDING,
          // Do NOT set userId at all - let Prisma handle it as undefined/null
        },
        update: {
          fullName, // Update the name if request already exists
          roomNumber, // Update room number
          status: AccountRequestStatus.PENDING, // Reset to pending
          updatedAt: new Date(),
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

      this.logger.log(
        `Account request created: ${accountRequest.id} for ${phone} at ${cooperative.name}`,
      );

      // Send SMS confirmation to the user
      try {
        await this.smsService.sendSms(
          phone,
          `Hello ${fullName}, your account request for ${cooperative.name} has been submitted. You will be notified once it's reviewed. Thank you!`,
        );
        this.logger.log(`SMS confirmation sent to ${phone}`);
      } catch (error) {
        this.logger.warn(
          `Failed to send SMS confirmation to ${phone}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      return this.mapToResponseDto(accountRequest);
    } catch (error: any) {
      this.logger.error(
        `Failed to create account request for ${phone}: ${error.message}`,
        error.stack,
      );
      
      if (error?.code === 'P2002') {
        const constraint = error?.meta?.target;
        this.logger.error(
          `Unique constraint violation: ${constraint}, Phone: ${phone}, Cooperative: ${cooperativeId}`,
        );
        
        if (constraint?.includes('userId')) {
          // Get more debugging info about the constraint violation
          const allUsersWithRequests = await this.prismaService.accountRequest.findMany({
            where: { userId: { not: null } },
            select: { id: true, phone: true, userId: true, status: true },
          }).catch(() => []);
          
          this.logger.error(
            `DEBUG: All account requests with userId: ${JSON.stringify(allUsersWithRequests)}`,
          );
          
          // Instead of our custom message, let's provide debugging info
          throw new ConflictException(
            `Database constraint error: A record with this user reference already exists. Please contact support if this persists. (Phone: ${phone})`,
          );
        } else if (constraint?.includes('phone_cooperativeId')) {
          throw new ConflictException(
            'You already have an account request for this cooperative',
          );
        } else {
          throw new ConflictException(
            `Database constraint error: ${constraint}. Phone: ${phone}, Cooperative: ${cooperativeId}`,
          );
        }
      }
      
      // If it's not a constraint error, throw the original error
      throw error;
    }
  }

  /**
   * Get all account requests with filters and role-based access
   */
  async getAccountRequests(
    status?: AccountRequestStatus,
    cooperativeId?: string,
    page = 1,
    limit = 10,
    userRole?: string,
    userCooperativeId?: string,
  ): Promise<{
    data: AccountRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where: any = {};

    // Apply role-based filtering
    if (userRole === 'ORGANIZATION_ADMIN' && userCooperativeId) {
      // Organization admins can only see requests for their cooperative
      where.cooperativeId = userCooperativeId;
    } else if (userRole === 'SUPER_ADMIN') {
      // Super admins can see all requests, optionally filtered by cooperative
      if (cooperativeId) {
        where.cooperativeId = cooperativeId;
      }
    } else {
      // Default: filter by cooperative if provided
      if (cooperativeId) {
        where.cooperativeId = cooperativeId;
      }
    }

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      this.prismaService.accountRequest.findMany({
        where,
        include: {
          cooperative: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          processedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.accountRequest.count({ where }),
    ]);

    const data = requests.map((request) => this.mapToResponseDto(request));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get account request by ID
   */
  async getAccountRequestById(id: string): Promise<AccountRequestResponseDto> {
    const request = await this.prismaService.accountRequest.findUnique({
      where: { id },
      include: {
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        processedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Account request not found');
    }

    return this.mapToResponseDto(request);
  }

  /**
   * Process account request (approve or reject)
   */
  async processAccountRequest(
    id: string,
    processDto: ProcessAccountRequestDto,
    adminUserId: string,
  ): Promise<AccountRequestResponseDto> {
    const { action, notes, rejectionReason } = processDto;

    const request = await this.prismaService.accountRequest.findUnique({
      where: { id },
      include: {
        cooperative: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Account request not found');
    }

    if (request.status !== AccountRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been processed');
    }

    if (action === 'REJECT' && !rejectionReason) {
      throw new BadRequestException(
        'Rejection reason is required when rejecting a request',
      );
    }

    if (action === 'APPROVE') {
      // Check if phone number is still available
      const existingUser = await this.prismaService.user.findUnique({
        where: { phone: request.phone },
      });

      if (existingUser) {
        throw new ConflictException(
          'A user with this phone number already exists',
        );
      }

      // Check if room is already occupied
      // TODO: Implement room validation after fixing Prisma types
      // For now, we'll skip this validation
      const existingRoomUser = null;

      if (existingRoomUser) {
        throw new ConflictException('This room number is already occupied');
      }

      // Generate default PIN (last 4 digits of phone number)
      const defaultPin = request.phone.slice(-4);
      const hashedPin = await bcrypt.hash(defaultPin, 12);

      // Split full name into first and last name
      const nameParts = request.fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create the user account
      const user = await this.prismaService.user.create({
        data: {
          phone: request.phone,
          pin: hashedPin,
          firstName,
          lastName,
          role: UserRole.TENANT,
          status: UserStatus.ACTIVE,
          cooperativeId: request.cooperativeId,
          profileData: {
            roomNumber: request.roomNumber,
            accountCreatedFromRequest: true,
            defaultPinUsed: true,
          },
        },
      });

      // Update the request
      const updatedRequest = await this.prismaService.accountRequest.update({
        where: { id },
        data: {
          status: AccountRequestStatus.APPROVED,
          processedBy: adminUserId,
          processedAt: new Date(),
          notes,
          userId: user.id,
        },
        include: {
          cooperative: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          processedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      this.logger.log(
        `Account request approved: ${id}, User created: ${user.id}, Default PIN: ${defaultPin}`,
      );

      // Send SMS notification about approval and account details
      try {
        await this.smsService.sendSms(
          request.phone,
          `Congratulations ${request.fullName}! Your account for ${request.cooperative.name} has been approved. Your login PIN is: ${defaultPin}. Please change it after first login for security.`,
        );
        this.logger.log(`SMS approval notification sent to ${request.phone}`);
      } catch (error) {
        this.logger.warn(
          `Failed to send SMS approval notification to ${request.phone}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      return this.mapToResponseDto(updatedRequest);
    } else {
      // Reject the request
      const updatedRequest = await this.prismaService.accountRequest.update({
        where: { id },
        data: {
          status: AccountRequestStatus.REJECTED,
          processedBy: adminUserId,
          processedAt: new Date(),
          notes,
          rejectionReason,
        },
        include: {
          cooperative: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          processedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      this.logger.log(
        `Account request rejected: ${id}, Reason: ${rejectionReason}`,
      );

      // Send SMS notification about rejection
      try {
        await this.smsService.sendSms(
          request.phone,
          `Hello ${request.fullName}, unfortunately your account request for ${request.cooperative.name} has been rejected. Reason: ${rejectionReason}. You may contact the cooperative for more information.`,
        );
        this.logger.log(`SMS rejection notification sent to ${request.phone}`);
      } catch (error) {
        this.logger.warn(
          `Failed to send SMS rejection notification to ${request.phone}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      return this.mapToResponseDto(updatedRequest);
    }
  }

  /**
   * Get account request statistics with role-based access
   */
  async getAccountRequestStats(
    cooperativeId?: string,
    userRole?: string,
    userCooperativeId?: string,
  ): Promise<AccountRequestStatsDto> {
    const where: any = {};

    // Apply role-based filtering for statistics
    if (userRole === 'ORGANIZATION_ADMIN' && userCooperativeId) {
      // Organization admins can only see stats for their cooperative
      where.cooperativeId = userCooperativeId;
    } else if (userRole === 'SUPER_ADMIN') {
      // Super admins can see all stats, optionally filtered by cooperative
      if (cooperativeId) {
        where.cooperativeId = cooperativeId;
      }
    } else {
      // Default: filter by cooperative if provided
      if (cooperativeId) {
        where.cooperativeId = cooperativeId;
      }
    }

    const [total, pending, approved, rejected] = await Promise.all([
      this.prismaService.accountRequest.count({ where }),
      this.prismaService.accountRequest.count({
        where: { ...where, status: AccountRequestStatus.PENDING },
      }),
      this.prismaService.accountRequest.count({
        where: { ...where, status: AccountRequestStatus.APPROVED },
      }),
      this.prismaService.accountRequest.count({
        where: { ...where, status: AccountRequestStatus.REJECTED },
      }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
    };
  }

  /**
   * Get organization account requests (for organization admins)
   */
  async getOrganizationAccountRequests(
    cooperativeId: string,
    status?: AccountRequestStatus,
    page = 1,
    limit = 10,
  ): Promise<{
    data: AccountRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    organizationInfo?: {
      id: string;
      name: string;
      code: string;
    };
  }> {
    const where: any = {
      cooperativeId,
    };

    if (status) {
      where.status = status;
    }

    const [requests, total, cooperative] = await Promise.all([
      this.prismaService.accountRequest.findMany({
        where,
        include: {
          cooperative: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          processedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.accountRequest.count({ where }),
      this.prismaService.cooperative.findUnique({
        where: { id: cooperativeId },
        select: {
          id: true,
          name: true,
          code: true,
        },
      }),
    ]);

    const data = requests.map((request) => this.mapToResponseDto(request));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      organizationInfo: cooperative || undefined,
    };
  }

  /**
   * Debug method to check database state and potentially fix corruption
   * This can help identify why the userId constraint is failing
   */
  async debugAccountRequestState(): Promise<{
    totalRequests: number;
    requestsWithUserId: any[];
    potentialCorruption: boolean;
    recommendations: string[];
  }> {
    const allRequests = await this.prismaService.accountRequest.findMany({
      select: {
        id: true,
        phone: true,
        userId: true,
        status: true,
        cooperativeId: true,
        createdAt: true,
      },
    });

    const requestsWithUserId = allRequests.filter(req => req.userId !== null);
    const userIdCounts: Record<string, number> = {};
    
    requestsWithUserId.forEach(req => {
      if (req.userId) {
        userIdCounts[req.userId] = (userIdCounts[req.userId] || 0) + 1;
      }
    });

    const duplicateUserIds = Object.entries(userIdCounts).filter(([_, count]) => (count as number) > 1);
    const potentialCorruption = duplicateUserIds.length > 0;

    const recommendations: string[] = [];
    if (potentialCorruption) {
      recommendations.push('Found duplicate userId values in account requests');
      recommendations.push('Consider running data cleanup to remove duplicate entries');
    }
    if (requestsWithUserId.length > 0) {
      recommendations.push(`Found ${requestsWithUserId.length} requests with userId set`);
    }

    return {
      totalRequests: allRequests.length,
      requestsWithUserId: requestsWithUserId.map(req => ({
        id: req.id,
        phone: req.phone,
        userId: req.userId,
        status: req.status,
      })),
      potentialCorruption,
      recommendations,
    };
  }

  /**
   * Delete account request (admin only)
   */
  async deleteAccountRequest(id: string): Promise<void> {
    const request = await this.prismaService.accountRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Account request not found');
    }

    await this.prismaService.accountRequest.delete({
      where: { id },
    });

    this.logger.log(`Account request deleted: ${id}`);
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponseDto(request: any): AccountRequestResponseDto {
    return {
      id: request.id,
      fullName: request.fullName,
      phone: request.phone,
      cooperative: {
        id: request.cooperative.id,
        name: request.cooperative.name,
        code: request.cooperative.code,
      },
      roomNumber: request.roomNumber,
      status: request.status,
      rejectionReason: request.rejectionReason,
      notes: request.notes,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      processedAt: request.processedAt,
      processedBy: request.processedUser
        ? {
            id: request.processedUser.id,
            fullName:
              `${request.processedUser.firstName} ${request.processedUser.lastName}`.trim(),
          }
        : undefined,
    };
  }
}
