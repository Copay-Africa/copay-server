import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReminderService } from '../application/reminder.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ReminderResponseDto } from './dto/reminder-response.dto';
import { ReminderFilterDto } from './dto/reminder-filter.dto';
import { ReminderSearchDto } from './dto/reminder-search.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Reminders')
@Controller('reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReminderController {
  constructor(private reminderService: ReminderService) {}

  @Post()
  @Roles('TENANT', 'ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Create a new payment reminder',
    description: 'Create a payment reminder with notification preferences',
  })
  @ApiResponse({
    status: 201,
    description: 'Reminder created successfully',
    type: ReminderResponseDto,
  })
  async createReminder(
    @Body() createReminderDto: CreateReminderDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ReminderResponseDto> {
    return this.reminderService.createReminder(
      createReminderDto,
      currentUser.id,
      currentUser.cooperativeId,
    );
  }

  @Get('search')
  @Roles('TENANT', 'ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Search reminders',
    description: 'Search reminders with advanced filtering options',
  })
  @ApiResponse({
    status: 200,
    description: 'Reminders found successfully',
    type: PaginatedResponseDto<ReminderResponseDto>,
  })
  async searchReminders(
    @Query() searchDto: ReminderSearchDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ReminderResponseDto>> {
    return this.reminderService.searchReminders(
      searchDto,
      currentUser.id,
      currentUser.cooperativeId || '',
      currentUser.role as UserRole,
    );
  }

  @Get()
  @Roles('TENANT', 'ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get reminders with filtering and pagination',
    description: 'Retrieve reminders based on user role and filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Reminders retrieved successfully',
    type: PaginatedResponseDto<ReminderResponseDto>,
  })
  async findAll(
    @Query() filterDto: ReminderFilterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ReminderResponseDto>> {
    return this.reminderService.findAll(
      filterDto,
      currentUser.id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user reminders',
    description: 'Retrieve reminders for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User reminders retrieved successfully',
    type: PaginatedResponseDto<ReminderResponseDto>,
  })
  async findMyReminders(
    @Query() filterDto: ReminderFilterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ReminderResponseDto>> {
    const userFilterDto = Object.assign(new ReminderFilterDto(), {
      ...filterDto,
      userId: currentUser.id,
    });
    return this.reminderService.findAll(
      userFilterDto,
      currentUser.id,
      UserRole.TENANT, // Force user-level access
      currentUser.cooperativeId,
    );
  }

  @Get('due')
  @Roles('TENANT', 'ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get due reminders',
    description: 'Get reminders that are due now or overdue',
  })
  @ApiResponse({
    status: 200,
    description: 'Due reminders retrieved successfully',
    type: PaginatedResponseDto<ReminderResponseDto>,
  })
  async findDueReminders(
    @Query() filterDto: ReminderFilterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ReminderResponseDto>> {
    const dueFilterDto = Object.assign(new ReminderFilterDto(), {
      ...filterDto,
      isDue: true,
    });
    return this.reminderService.findAll(
      dueFilterDto,
      currentUser.id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Get(':id')
  @Roles('TENANT', 'ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get reminder by ID',
    description: 'Retrieve a specific reminder by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Reminder retrieved successfully',
    type: ReminderResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ReminderResponseDto> {
    return this.reminderService.findById(
      id,
      currentUser.id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Put(':id')
  @Roles('TENANT', 'ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Update a reminder',
    description: 'Update an existing reminder',
  })
  @ApiResponse({
    status: 200,
    description: 'Reminder updated successfully',
    type: ReminderResponseDto,
  })
  async updateReminder(
    @Param('id') id: string,
    @Body() updateReminderDto: UpdateReminderDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ReminderResponseDto> {
    return this.reminderService.updateReminder(
      id,
      updateReminderDto,
      currentUser.id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Delete(':id')
  @Roles('TENANT', 'ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Delete a reminder',
    description: 'Delete an existing reminder',
  })
  @ApiResponse({
    status: 204,
    description: 'Reminder deleted successfully',
  })
  async deleteReminder(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.reminderService.deleteReminder(
      id,
      currentUser.id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }
}
