import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRoomDto } from '../presentation/dto/create-room.dto';
import { UpdateRoomDto } from '../presentation/dto/update-room.dto';
import { RoomFilterDto } from '../presentation/dto/room-filter.dto';
import {
  AssignRoomDto,
  UnassignRoomDto,
} from '../presentation/dto/assign-room.dto';
import { RoomResponseDto } from '../presentation/dto/room-response.dto';
import { UserRoomResponseDto } from '../presentation/dto/user-room-response.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { RoomStatus, UserRole } from '@prisma/client';

@Injectable()
export class RoomService {
  constructor(private prismaService: PrismaService) {}

  /**
   * Create a new room
   */
  async create(
    createRoomDto: CreateRoomDto,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<RoomResponseDto> {
    // Verify cooperative exists
    const cooperative = await this.prismaService.cooperative.findUnique({
      where: { id: createRoomDto.cooperativeId },
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

    // Check if room number already exists in the cooperative
    const existingRoom = await this.prismaService.room.findFirst({
      where: {
        cooperativeId: createRoomDto.cooperativeId,
        roomNumber: createRoomDto.roomNumber,
      },
    });

    if (existingRoom) {
      throw new ConflictException(
        `Room number ${createRoomDto.roomNumber} already exists in this cooperative`,
      );
    }

    const room = await this.prismaService.room.create({
      data: {
        roomNumber: createRoomDto.roomNumber,
        roomType: createRoomDto.roomType,
        floor: createRoomDto.floor,
        block: createRoomDto.block,
        description: createRoomDto.description,
        status: createRoomDto.status || RoomStatus.AVAILABLE,
        baseRent: createRoomDto.baseRent,
        deposit: createRoomDto.deposit,
        specifications: createRoomDto.specifications || {},
        cooperativeId: createRoomDto.cooperativeId,
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
        userCooperativeRooms: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return this.mapToResponseDto(room);
  }

  /**
   * Get all rooms with filtering and pagination
   */
  async findAll(
    filterDto: RoomFilterDto,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<PaginatedResponseDto<RoomResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      cooperativeId,
      ...filters
    } = filterDto;

    // Build where clause
    const where: any = {};

    // Apply cooperative filter based on user role
    if (currentUserRole !== UserRole.SUPER_ADMIN) {
      where.cooperativeId = currentCooperativeId;
    } else if (cooperativeId) {
      where.cooperativeId = cooperativeId;
    }

    // Apply status filter
    if (filters.status) {
      where.status = filters.status;
    }

    // Apply room type filter
    if (filters.roomType) {
      where.roomType = { contains: filters.roomType, mode: 'insensitive' };
    }

    // Apply floor filter
    if (filters.floor) {
      where.floor = { contains: filters.floor, mode: 'insensitive' };
    }

    // Apply block filter
    if (filters.block) {
      where.block = { contains: filters.block, mode: 'insensitive' };
    }

    // Apply search filter
    if (search) {
      where.OR = [
        { roomNumber: { contains: search, mode: 'insensitive' } },
        { roomType: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { floor: { contains: search, mode: 'insensitive' } },
        { block: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rooms, total] = await Promise.all([
      this.prismaService.room.findMany({
        where,
        include: {
          cooperative: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
            },
          },
          userCooperativeRooms: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  phone: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: [{ block: 'asc' }, { floor: 'asc' }, { roomNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.room.count({ where }),
    ]);

    const roomDtos = rooms.map((room) => this.mapToResponseDto(room));

    return new PaginatedResponseDto(roomDtos, total, page, limit);
  }

  /**
   * Get room by ID
   */
  async findOne(
    id: string,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<RoomResponseDto> {
    const room = await this.prismaService.room.findUnique({
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
        userCooperativeRooms: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      room.cooperativeId !== currentCooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapToResponseDto(room);
  }

  /**
   * Update room
   */
  async update(
    id: string,
    updateRoomDto: UpdateRoomDto,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<RoomResponseDto> {
    const existingRoom = await this.prismaService.room.findUnique({
      where: { id },
      include: { cooperative: true },
    });

    if (!existingRoom) {
      throw new NotFoundException('Room not found');
    }

    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      existingRoom.cooperativeId !== currentCooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    // Check if room number conflict exists (if changing room number)
    if (
      updateRoomDto.roomNumber &&
      updateRoomDto.roomNumber !== existingRoom.roomNumber
    ) {
      const conflictingRoom = await this.prismaService.room.findFirst({
        where: {
          cooperativeId: existingRoom.cooperativeId,
          roomNumber: updateRoomDto.roomNumber,
          id: { not: id },
        },
      });

      if (conflictingRoom) {
        throw new ConflictException(
          `Room number ${updateRoomDto.roomNumber} already exists in this cooperative`,
        );
      }
    }

    const updatedRoom = await this.prismaService.room.update({
      where: { id },
      data: {
        ...updateRoomDto,
        specifications: updateRoomDto.specifications
          ? {
              ...((existingRoom.specifications as Record<string, any>) || {}),
              ...(updateRoomDto.specifications as Record<string, any>),
            }
          : existingRoom.specifications,
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
        userCooperativeRooms: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return this.mapToResponseDto(updatedRoom);
  }

  /**
   * Delete room
   */
  async remove(
    id: string,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<void> {
    const room = await this.prismaService.room.findUnique({
      where: { id },
      include: {
        userCooperativeRooms: {
          where: { isActive: true },
        },
        payments: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      room.cooperativeId !== currentCooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    // Check if room has active assignments
    if (room.userCooperativeRooms.length > 0) {
      throw new BadRequestException(
        'Cannot delete room with active tenant assignments. Please unassign all tenants first.',
      );
    }

    // Check if room has payment history
    if (room.payments.length > 0) {
      throw new BadRequestException(
        'Cannot delete room with payment history. Consider marking it as OUT_OF_SERVICE instead.',
      );
    }

    await this.prismaService.room.delete({
      where: { id },
    });
  }

  /**
   * Assign user to room
   */
  async assignRoom(
    roomId: string,
    assignRoomDto: AssignRoomDto,
    assignedBy: string,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<UserRoomResponseDto> {
    // Get room and validate access
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
      include: {
        cooperative: true,
        userCooperativeRooms: {
          where: { isActive: true },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      room.cooperativeId !== currentCooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    // Check if room is available
    if (room.status !== RoomStatus.AVAILABLE) {
      throw new BadRequestException('Room is not available for assignment');
    }

    // Check if room already has active assignment
    if (room.userCooperativeRooms.length > 0) {
      throw new BadRequestException(
        'Room is already assigned to another tenant',
      );
    }

    // Get user and validate
    const user = await this.prismaService.user.findUnique({
      where: { id: assignRoomDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already has active room in this cooperative
    const existingAssignment =
      await this.prismaService.userCooperativeRoom.findFirst({
        where: {
          userId: assignRoomDto.userId,
          cooperativeId: room.cooperativeId,
          isActive: true,
        },
      });

    if (existingAssignment) {
      throw new BadRequestException(
        'User already has an active room assignment in this cooperative',
      );
    }

    // Create assignment and update room status
    const [assignment] = await this.prismaService.$transaction([
      this.prismaService.userCooperativeRoom.create({
        data: {
          userId: assignRoomDto.userId,
          cooperativeId: room.cooperativeId,
          roomId,
          startDate: assignRoomDto.startDate
            ? new Date(assignRoomDto.startDate)
            : new Date(),
          endDate: assignRoomDto.endDate
            ? new Date(assignRoomDto.endDate)
            : null,
          notes: assignRoomDto.notes,
          assignedBy,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          cooperative: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
            },
          },
          room: {
            select: {
              id: true,
              roomNumber: true,
              roomType: true,
              floor: true,
              block: true,
              status: true,
              baseRent: true,
              deposit: true,
            },
          },
        },
      }),
      this.prismaService.room.update({
        where: { id: roomId },
        data: { status: RoomStatus.OCCUPIED },
      }),
    ]);

    return this.mapToUserRoomResponseDto(assignment);
  }

  /**
   * Unassign user from room
   */
  async unassignRoom(
    roomId: string,
    unassignRoomDto: UnassignRoomDto,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<void> {
    // Get room and validate access
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      room.cooperativeId !== currentCooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    // Find active assignment
    const assignment = await this.prismaService.userCooperativeRoom.findFirst({
      where: {
        roomId,
        isActive: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('No active assignment found for this room');
    }

    // Update assignment and room status
    await this.prismaService.$transaction([
      this.prismaService.userCooperativeRoom.update({
        where: { id: assignment.id },
        data: {
          isActive: false,
          endDate: unassignRoomDto.endDate
            ? new Date(unassignRoomDto.endDate)
            : new Date(),
          notes: unassignRoomDto.notes
            ? `${assignment.notes || ''}\nUnassigned: ${unassignRoomDto.notes}`.trim()
            : assignment.notes,
        },
      }),
      this.prismaService.room.update({
        where: { id: roomId },
        data: { status: RoomStatus.AVAILABLE },
      }),
    ]);
  }

  /**
   * Get user's rooms across all cooperatives
   */
  async getUserRooms(userId: string): Promise<UserRoomResponseDto[]> {
    const assignments = await this.prismaService.userCooperativeRoom.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
        room: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            floor: true,
            block: true,
            status: true,
            baseRent: true,
            deposit: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((assignment) =>
      this.mapToUserRoomResponseDto(assignment),
    );
  }

  /**
   * Get cooperative's room assignments
   */
  async getCooperativeRoomAssignments(
    cooperativeId: string,
    currentUserRole?: UserRole,
    currentCooperativeId?: string,
  ): Promise<UserRoomResponseDto[]> {
    // Check tenant isolation
    if (
      currentUserRole !== UserRole.SUPER_ADMIN &&
      cooperativeId !== currentCooperativeId
    ) {
      throw new ForbiddenException('Access denied');
    }

    const assignments = await this.prismaService.userCooperativeRoom.findMany({
      where: {
        cooperativeId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        cooperative: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
        room: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            floor: true,
            block: true,
            status: true,
            baseRent: true,
            deposit: true,
          },
        },
      },
      orderBy: [
        { room: { block: 'asc' } },
        { room: { floor: 'asc' } },
        { room: { roomNumber: 'asc' } },
      ],
    });

    return assignments.map((assignment) =>
      this.mapToUserRoomResponseDto(assignment),
    );
  }

  /**
   * Map room to response DTO
   */
  private mapToResponseDto(room: any): RoomResponseDto {
    const activeAssignment = room.userCooperativeRooms?.find(
      (ucr: any) => ucr.isActive,
    );

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      floor: room.floor,
      block: room.block,
      description: room.description,
      status: room.status,
      baseRent: room.baseRent,
      deposit: room.deposit,
      cooperative: {
        id: room.cooperative.id,
        name: room.cooperative.name,
        code: room.cooperative.code,
        status: room.cooperative.status,
      },
      currentTenant: activeAssignment
        ? {
            id: activeAssignment.user.id,
            phone: activeAssignment.user.phone,
            firstName: activeAssignment.user.firstName,
            lastName: activeAssignment.user.lastName,
            assignedAt: activeAssignment.assignedAt,
            startDate: activeAssignment.startDate,
          }
        : undefined,
      specifications: room.specifications,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  /**
   * Map assignment to user room response DTO
   */
  private mapToUserRoomResponseDto(assignment: any): UserRoomResponseDto {
    return {
      id: assignment.id,
      user: assignment.user,
      cooperative: assignment.cooperative,
      room: assignment.room,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      isActive: assignment.isActive,
      notes: assignment.notes,
      assignedAt: assignment.assignedAt,
      assignedBy: assignment.assignedBy,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }
}
