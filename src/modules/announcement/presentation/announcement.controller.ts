import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AnnouncementService } from '../application/announcement.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/create-announcement.dto';
import {
  AnnouncementResponseDto,
  AnnouncementSummaryDto,
  AnnouncementStatsDto,
} from './dto/announcement-response.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { AnnouncementStatus, UserRole } from '@prisma/client';

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnnouncementController {
  constructor(private announcementService: AnnouncementService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Create a new announcement',
    description: `
      Create and send announcements to targeted audiences with role-based notification channels:
      
      **Tenant Notifications**: IN_APP, PUSH, SMS
      **Organization Admin Notifications**: IN_APP, SMS
      
      **Targeting Options**:
      - ALL_TENANTS: Target all tenants (org admins: only in their cooperative)
      - ALL_ORGANIZATION_ADMINS: Target all organization admins (super admin only)
      - SPECIFIC_COOPERATIVE: Target specific cooperatives
      - SPECIFIC_USERS: Target specific user IDs
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Announcement created successfully',
    type: AnnouncementResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or targeting permissions',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions for targeting or notification types',
  })
  async createAnnouncement(
    @Body() createAnnouncementDto: CreateAnnouncementDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AnnouncementResponseDto> {
    return this.announcementService.createAnnouncement(
      createAnnouncementDto,
      currentUser.id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get all announcements',
    description: `
      Retrieve announcements with role-based filtering:
      - **Super Admin**: Can view all announcements across all cooperatives
      - **Organization Admin**: Can view only their cooperative's announcements
      - **Tenant**: Cannot access this endpoint
    `,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AnnouncementStatus,
    description: 'Filter by announcement status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in title and message',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Field to sort by (default: createdAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  @ApiResponse({
    status: 200,
    description: 'Announcements retrieved successfully',
    type: 'object',
    schema: {
      allOf: [
        { $ref: '#/components/schemas/PaginatedResponseDto' },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AnnouncementSummaryDto' },
            },
          },
        },
      ],
    },
  })
  async getAnnouncements(
    @Query() paginationDto: PaginationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('status') status?: AnnouncementStatus,
  ): Promise<PaginatedResponseDto<AnnouncementSummaryDto>> {
    return this.announcementService.getAnnouncements(
      paginationDto,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
      status,
    );
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get announcement statistics',
    description: 'Retrieve announcement statistics with role-based filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Announcement statistics retrieved successfully',
    type: AnnouncementStatsDto,
  })
  async getAnnouncementStats(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AnnouncementStatsDto> {
    return this.announcementService.getAnnouncementStats(
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get announcement by ID',
    description: 'Retrieve detailed announcement information',
  })
  @ApiParam({
    name: 'id',
    description: 'Announcement ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Announcement retrieved successfully',
    type: AnnouncementResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Announcement not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied to this announcement',
  })
  async getAnnouncementById(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AnnouncementResponseDto> {
    return this.announcementService.getAnnouncementById(
      id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Update announcement',
    description:
      'Update announcement details (only draft and scheduled announcements can be updated)',
  })
  @ApiParam({
    name: 'id',
    description: 'Announcement ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Announcement updated successfully',
    type: AnnouncementResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot update sent announcements',
  })
  @ApiResponse({
    status: 404,
    description: 'Announcement not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied to this announcement',
  })
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AnnouncementResponseDto> {
    return this.announcementService.updateAnnouncement(
      id,
      updateAnnouncementDto,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete announcement',
    description:
      'Delete announcement (only draft and scheduled announcements can be deleted)',
  })
  @ApiParam({
    name: 'id',
    description: 'Announcement ID',
  })
  @ApiResponse({
    status: 204,
    description: 'Announcement deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete sent announcements',
  })
  @ApiResponse({
    status: 404,
    description: 'Announcement not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied to this announcement',
  })
  async deleteAnnouncement(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.announcementService.deleteAnnouncement(
      id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Post(':id/send')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send announcement immediately',
    description: 'Send a draft or scheduled announcement immediately',
  })
  @ApiParam({
    name: 'id',
    description: 'Announcement ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Announcement sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Announcement sent successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Announcement not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Announcement already sent',
  })
  async sendAnnouncement(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<{ message: string }> {
    // First verify user has access to this announcement
    await this.announcementService.getAnnouncementById(
      id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );

    await this.announcementService.sendAnnouncement(id);
    return { message: 'Announcement sent successfully' };
  }
}
