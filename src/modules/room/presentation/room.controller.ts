import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RoomService } from '../application/room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { RoomFilterDto } from './dto/room-filter.dto';
import { AssignRoomDto, UnassignRoomDto } from './dto/assign-room.dto';
import { UserRoomResponseDto } from './dto/user-room-response.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles, Public } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

type AuthenticatedUser = {
  id: string;
  phone: string;
  role: UserRole;
  cooperativeId?: string;
};

@ApiTags('Room Management')
@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({
    status: 201,
    description: 'Room created successfully',
    type: RoomResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Room number already exists' })
  async create(
    @Body() createRoomDto: CreateRoomDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    return this.roomService.create(
      createRoomDto,
      currentUser.role,
      currentUser.cooperativeId,
    );
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all rooms with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Rooms retrieved successfully',
    type: 'object',
    isArray: false,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by room number, type, or description',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by room status',
    enum: [
      'AVAILABLE',
      'OCCUPIED',
      'MAINTENANCE',
      'RESERVED',
      'OUT_OF_SERVICE',
    ],
  })
  @ApiQuery({
    name: 'roomType',
    required: false,
    description: 'Filter by room type',
  })
  @ApiQuery({ name: 'floor', required: false, description: 'Filter by floor' })
  @ApiQuery({ name: 'block', required: false, description: 'Filter by block' })
  @ApiQuery({
    name: 'cooperativeId',
    required: false,
    description: 'Filter by cooperative ID',
  })
  async findAll(
    @Query() filterDto: RoomFilterDto,
  ): Promise<PaginatedResponseDto<RoomResponseDto>> {
    return this.roomService.findAll(filterDto);
  }

  @Get('assignments/cooperative/:cooperativeId')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Get all room assignments for a cooperative' })
  @ApiParam({ name: 'cooperativeId', description: 'Cooperative ID' })
  @ApiResponse({
    status: 200,
    description: 'Room assignments retrieved successfully',
    type: [UserRoomResponseDto],
  })
  async getCooperativeRoomAssignments(
    @Param('cooperativeId') cooperativeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserRoomResponseDto[]> {
    return this.roomService.getCooperativeRoomAssignments(
      cooperativeId,
      currentUser.role,
      currentUser.cooperativeId,
    );
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: "Get user's room assignments across all cooperatives",
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User rooms retrieved successfully',
    type: [UserRoomResponseDto],
  })
  async getUserRooms(
    @Param('userId') userId: string,
  ): Promise<UserRoomResponseDto[]> {
    return this.roomService.getUserRooms(userId);
  }

  @Get('me')
  @ApiOperation({ summary: "Get current user's room assignments" })
  @ApiResponse({
    status: 200,
    description: 'Current user rooms retrieved successfully',
    type: [UserRoomResponseDto],
  })
  async getCurrentUserRooms(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserRoomResponseDto[]> {
    return this.roomService.getUserRooms(currentUser.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get room statistics for cooperative' })
  @ApiQuery({
    name: 'cooperativeId',
    required: false,
    description: 'Cooperative ID (required for org admins)',
  })
  @ApiResponse({
    status: 200,
    description: 'Room statistics retrieved successfully',
    type: 'object',
  })
  async getRoomStats(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('cooperativeId') cooperativeId?: string,
  ): Promise<any> {
    return this.roomService.getRoomStats(
      cooperativeId,
      currentUser.role,
      currentUser.cooperativeId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({
    status: 200,
    description: 'Room retrieved successfully',
    type: RoomResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    return this.roomService.findOne(
      id,
      currentUser.role,
      currentUser.cooperativeId,
    );
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Update room details' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({
    status: 200,
    description: 'Room updated successfully',
    type: RoomResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 409, description: 'Room number conflict' })
  async update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    return this.roomService.update(
      id,
      updateRoomDto,
      currentUser.role,
      currentUser.cooperativeId,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Delete room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 204, description: 'Room deleted successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({
    status: 400,
    description:
      'Cannot delete room with active assignments or payment history',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.roomService.remove(
      id,
      currentUser.role,
      currentUser.cooperativeId,
    );
  }

  @Post(':id/assign')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Assign user to room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({
    status: 201,
    description: 'Room assigned successfully',
    type: UserRoomResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Room or user not found' })
  @ApiResponse({
    status: 400,
    description: 'Room not available or user already assigned',
  })
  async assignRoom(
    @Param('id') roomId: string,
    @Body() assignRoomDto: AssignRoomDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserRoomResponseDto> {
    return this.roomService.assignRoom(
      roomId,
      assignRoomDto,
      currentUser.id,
      currentUser.role,
      currentUser.cooperativeId,
    );
  }

  @Post(':id/unassign')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Unassign user from room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Room unassigned successfully' })
  @ApiResponse({ status: 404, description: 'Room or assignment not found' })
  @HttpCode(HttpStatus.OK)
  async unassignRoom(
    @Param('id') roomId: string,
    @Body() unassignRoomDto: UnassignRoomDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.roomService.unassignRoom(
      roomId,
      unassignRoomDto,
      currentUser.role,
      currentUser.cooperativeId,
    );
  }
}
