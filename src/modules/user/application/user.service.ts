import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserDto } from '../presentation/dto/create-user.dto';
import { UserResponseDto } from '../presentation/dto/user-response.dto';
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
}
