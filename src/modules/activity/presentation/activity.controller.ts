import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ActivityService } from '../application/activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ActivityResponseDto } from './dto/activity-response.dto';
import { ActivityFilterDto } from './dto/activity-filter.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

@ApiTags('Activities')
@Controller('activities')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new activity record',
    description:
      'Manually create an activity record (typically used by system processes)',
  })
  @ApiResponse({
    status: 201,
    description: 'Activity created successfully',
    type: ActivityResponseDto,
  })
  async createActivity(
    @Body() createActivityDto: CreateActivityDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ActivityResponseDto> {
    const context = {
      userId: currentUser.id,
      cooperativeId: currentUser.cooperativeId,
      ipAddress: request.ip || request.connection.remoteAddress,
      userAgent: request.headers['user-agent'],
    };

    return this.activityService.createActivity(createActivityDto, context);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'TENANT')
  @ApiOperation({
    summary: 'Get activities with filtering and pagination',
    description:
      'Retrieve activities based on user role and filters. Users see only their activities, admins see cooperative activities, super admins see all.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activities retrieved successfully',
    type: PaginatedResponseDto<ActivityResponseDto>,
  })
  async findAll(
    @Query() filterDto: ActivityFilterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ActivityResponseDto>> {
    return this.activityService.findAll(
      filterDto,
      currentUser.id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user activities',
    description: 'Retrieve activities for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User activities retrieved successfully',
    type: PaginatedResponseDto<ActivityResponseDto>,
  })
  async findMyActivities(
    @Query() filterDto: ActivityFilterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ActivityResponseDto>> {
    return this.activityService.findUserActivities(currentUser.id, filterDto);
  }

  @Get('security')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get security-related activities',
    description: 'Retrieve only security events and suspicious activities',
  })
  @ApiResponse({
    status: 200,
    description: 'Security activities retrieved successfully',
    type: PaginatedResponseDto<ActivityResponseDto>,
  })
  async findSecurityActivities(
    @Query() filterDto: ActivityFilterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ActivityResponseDto>> {
    const securityFilterDto = new ActivityFilterDto();
    Object.assign(securityFilterDto, filterDto);
    securityFilterDto.isSecurityEvent = true;

    return this.activityService.findAll(
      securityFilterDto,
      currentUser.id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }
}
