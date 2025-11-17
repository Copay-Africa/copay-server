import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCooperativeDto } from '../presentation/dto/create-cooperative.dto';
import { CooperativeResponseDto } from '../presentation/dto/cooperative-response.dto';
import { CooperativeSearchDto } from '../presentation/dto/cooperative-search.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { CooperativeStatus, UserRole } from '@prisma/client';

@Injectable()
export class CooperativeService {
  constructor(private prismaService: PrismaService) {}

  async create(
    createCooperativeDto: CreateCooperativeDto,
  ): Promise<CooperativeResponseDto> {
    // Check if cooperative code already exists
    const existingCooperative = await this.prismaService.cooperative.findUnique(
      {
        where: { code: createCooperativeDto.code },
      },
    );

    if (existingCooperative) {
      throw new ConflictException('Cooperative code already exists');
    }

    // Validate category exists
    const category = await this.prismaService.cooperativeCategory.findUnique({
      where: { id: createCooperativeDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Create cooperative
    const cooperative = await this.prismaService.cooperative.create({
      data: {
        ...createCooperativeDto,
        status: CooperativeStatus.ACTIVE, // Auto-activate for now
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    return this.mapToResponseDto(cooperative);
  }

  async findAll(
    paginationDto: PaginationDto,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<PaginatedResponseDto<CooperativeResponseDto>> {
    const { page, limit, search, sortBy, sortOrder, skip } = paginationDto;

    // Build where clause based on user role and search
    const where: any = {};

    // Apply tenant isolation for non-super admins
    if (currentUserRole !== UserRole.SUPER_ADMIN && currentCooperativeId) {
      where.id = currentCooperativeId;
    }

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
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
    const [cooperatives, total] = await Promise.all([
      this.prismaService.cooperative.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          _count: {
            select: { users: true },
          },
        },
      }),
      this.prismaService.cooperative.count({ where }),
    ]);

    const cooperativeResponses = cooperatives.map((coop) =>
      this.mapToResponseDto(coop),
    );

    return new PaginatedResponseDto(
      cooperativeResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async searchCooperatives(
    searchDto: CooperativeSearchDto,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<PaginatedResponseDto<CooperativeResponseDto>> {
    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      skip,
      status,
      fromDate,
      toDate,
    } = searchDto;

    // Build where clause based on user role and search
    const where: any = {};

    // Apply tenant isolation for non-super admins
    if (currentUserRole !== UserRole.SUPER_ADMIN && currentCooperativeId) {
      where.id = currentCooperativeId;
    }

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Add status filter
    if (status) {
      where.status = status;
    }

    // Add date range filters
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
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
    const [cooperatives, total] = await Promise.all([
      this.prismaService.cooperative.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          _count: {
            select: { users: true },
          },
        },
      }),
      this.prismaService.cooperative.count({ where }),
    ]);

    const cooperativeResponses = cooperatives.map((coop) =>
      this.mapToResponseDto(coop),
    );

    return new PaginatedResponseDto(
      cooperativeResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async findOne(
    id: string,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<CooperativeResponseDto> {
    const cooperative = await this.prismaService.cooperative.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      cooperative.id !== currentCooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapToResponseDto(cooperative);
  }

  async updateStatus(
    id: string,
    status: CooperativeStatus,
  ): Promise<CooperativeResponseDto> {
    const cooperative = await this.prismaService.cooperative.findUnique({
      where: { id },
    });

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    const updatedCooperative = await this.prismaService.cooperative.update({
      where: { id },
      data: { status },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    return this.mapToResponseDto(updatedCooperative);
  }

  async findAllPublic(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<CooperativeResponseDto>> {
    const { page, limit, search, sortBy, sortOrder, skip } = paginationDto;

    // Build where clause - only show ACTIVE cooperatives publicly
    const where: any = {
      status: CooperativeStatus.ACTIVE,
    };

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
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
    const [cooperatives, total] = await Promise.all([
      this.prismaService.cooperative.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          _count: {
            select: { users: true },
          },
        },
      }),
      this.prismaService.cooperative.count({ where }),
    ]);

    const cooperativeResponses = cooperatives.map((coop) =>
      this.mapToResponseDto(coop),
    );

    return new PaginatedResponseDto(
      cooperativeResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async findOnePublic(id: string): Promise<CooperativeResponseDto> {
    const cooperative = await this.prismaService.cooperative.findUnique({
      where: {
        id,
        status: CooperativeStatus.ACTIVE, // Only show active cooperatives publicly
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    return this.mapToResponseDto(cooperative);
  }

  private mapToResponseDto(cooperative: any): CooperativeResponseDto {
    return {
      id: cooperative.id,
      name: cooperative.name,
      code: cooperative.code,
      categoryId: cooperative.categoryId,
      category: cooperative.category ? {
        id: cooperative.category.id,
        name: cooperative.category.name,
        description: cooperative.category.description,
      } : undefined,
      description: cooperative.description,
      address: cooperative.address,
      phone: cooperative.phone,
      email: cooperative.email,
      status: cooperative.status,
      settings: cooperative.settings,
      memberCount: cooperative._count?.users || 0,
      createdAt: cooperative.createdAt,
      updatedAt: cooperative.updatedAt,
    };
  }
}
