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

    // Create the account request
    const accountRequest = await this.prismaService.accountRequest.create({
      data: {
        fullName,
        phone,
        cooperativeId,
        roomNumber,
        status: AccountRequestStatus.PENDING,
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
  }

  /**
   * Get all account requests with filters
   */
  async getAccountRequests(
    status?: AccountRequestStatus,
    cooperativeId?: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: AccountRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (cooperativeId) {
      where.cooperativeId = cooperativeId;
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
   * Get account request statistics
   */
  async getAccountRequestStats(
    cooperativeId?: string,
  ): Promise<AccountRequestStatsDto> {
    const where: any = {};
    if (cooperativeId) {
      where.cooperativeId = cooperativeId;
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
