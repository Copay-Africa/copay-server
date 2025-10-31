import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ComplaintService } from '../application/complaint.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { ComplaintFilterDto } from './dto/complaint-filter.dto';
import { ComplaintResponseDto } from './dto/complaint-response.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Complaints')
@Controller('complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ComplaintController {
  constructor(private complaintService: ComplaintService) {}

  @Post()
  @Roles(UserRole.TENANT, UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new complaint',
    description: 'Tenants can submit complaints about issues in their cooperative housing',
  })
  @ApiResponse({
    status: 201,
    description: 'Complaint created successfully',
    type: ComplaintResponseDto,
  })
  async createComplaint(
    @Body() createComplaintDto: CreateComplaintDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ComplaintResponseDto> {
    return this.complaintService.createComplaint(createComplaintDto, {
      userId: currentUser.id,
      cooperativeId: currentUser.cooperativeId!,
      userRole: currentUser.role as UserRole,
    });
  }

  @Get()
  @Roles(UserRole.TENANT, UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get complaints',
    description: 'Get complaints based on user role - tenants see their own, admins see all in cooperative',
  })
  @ApiResponse({
    status: 200,
    description: 'Complaints retrieved successfully',
    type: PaginatedResponseDto<ComplaintResponseDto>,
  })
  async findAll(
    @Query() filterDto: ComplaintFilterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ComplaintResponseDto>> {
    return this.complaintService.findAll(filterDto, {
      userId: currentUser.id,
      cooperativeId: currentUser.cooperativeId!,
      userRole: currentUser.role as UserRole,
    });
  }

  @Get('my')
  @Roles(UserRole.TENANT, UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get current user complaints',
    description: 'Get complaints submitted by the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'User complaints retrieved successfully',
    type: PaginatedResponseDto<ComplaintResponseDto>,
  })
  async findMyComplaints(
    @Query() filterDto: ComplaintFilterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ComplaintResponseDto>> {
    // Force filter to current user's complaints
    const userFilterDto = Object.assign(new ComplaintFilterDto(), filterDto, { userId: currentUser.id });
    return this.complaintService.findAll(userFilterDto, {
      userId: currentUser.id,
      cooperativeId: currentUser.cooperativeId!,
      userRole: UserRole.TENANT, // Treat as tenant to only see own complaints
    });
  }

  @Get('organization')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get organization complaints',
    description: 'Organization admins can view all complaints from their cooperative tenants',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization complaints retrieved successfully',
    type: PaginatedResponseDto<ComplaintResponseDto>,
  })
  async findOrganizationComplaints(
    @Query() filterDto: ComplaintFilterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ComplaintResponseDto>> {
    return this.complaintService.findAll(filterDto, {
      userId: currentUser.id,
      cooperativeId: currentUser.cooperativeId!,
      userRole: currentUser.role as UserRole,
    });
  }

  @Get('organization/stats')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get complaint statistics for organization',
    description: 'Get complaint summary statistics including status breakdown and priority distribution',
  })
  @ApiResponse({
    status: 200,
    description: 'Complaint statistics retrieved successfully',
  })
  async getOrganizationComplaintStats(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<any> {
    return this.complaintService.getComplaintStats(
      {
        userId: currentUser.id,
        cooperativeId: currentUser.cooperativeId!,
        userRole: currentUser.role as UserRole,
      },
      { fromDate, toDate },
    );
  }

  @Get(':id')
  @Roles(UserRole.TENANT, UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get complaint by ID',
    description: 'Get detailed complaint information. Tenants can only view their own complaints.',
  })
  @ApiResponse({
    status: 200,
    description: 'Complaint retrieved successfully',
    type: ComplaintResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ComplaintResponseDto> {
    return this.complaintService.findById(id, {
      userId: currentUser.id,
      cooperativeId: currentUser.cooperativeId!,
      userRole: currentUser.role as UserRole,
    });
  }

  @Patch(':id/status')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update complaint status',
    description: 'Organization admins can update complaint status and add resolution messages',
  })
  @ApiResponse({
    status: 200,
    description: 'Complaint status updated successfully',
    type: ComplaintResponseDto,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateComplaintStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ComplaintResponseDto> {
    return this.complaintService.updateStatus(id, updateStatusDto, {
      userId: currentUser.id,
      cooperativeId: currentUser.cooperativeId!,
      userRole: currentUser.role as UserRole,
    });
  }
}