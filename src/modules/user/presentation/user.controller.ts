import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '../application/user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import {
  CurrentUserResponseDto,
  CooperativeDetailsDto,
} from './dto/current-user-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantFilterDto } from './dto/tenant-filter.dto';
import { TenantDetailResponseDto } from './dto/tenant-detail-response.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole, UserStatus } from '@prisma/client';
import { ApproveTenantDto } from './dto/approve-tenant.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private userService: UserService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.userService.create(createUserDto, currentUser.id);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: PaginatedResponseDto<UserResponseDto>,
  })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.userService.findAll(
      paginationDto,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      "Returns the authenticated user's profile information based on JWT token",
  })
  @ApiResponse({
    status: 200,
    description: 'Current user retrieved successfully',
    type: CurrentUserResponseDto,
  })
  async getCurrentUser(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CurrentUserResponseDto> {
    return this.userService.getCurrentUser(currentUser.id);
  }

  @Get('me/cooperatives')
  @ApiOperation({
    summary: 'Get user accessible cooperatives',
    description: 'Returns list of cooperatives the user can make payments for',
  })
  @ApiResponse({
    status: 200,
    description: 'User cooperatives retrieved successfully',
    type: [CooperativeDetailsDto],
  })
  async getUserCooperatives(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CooperativeDetailsDto[]> {
    return this.userService.getUserCooperatives(currentUser.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.userService.findOne(
      id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Update user status' })
  @ApiResponse({
    status: 200,
    description: 'User status updated successfully',
    type: UserResponseDto,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ): Promise<UserResponseDto> {
    return this.userService.updateStatus(id, status);
  }

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ 
    summary: 'Approve or reject tenant with SMS notification',
    description: 'Approve tenant (generates PIN and sends SMS with credentials) or reject tenant (sends rejection SMS with reason)'
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant approval/rejection processed successfully',
    type: UserResponseDto,
  })
  async approveTenant(
    @Param('id') id: string,
    @Body() approveTenantDto: ApproveTenantDto,
  ): Promise<UserResponseDto> {
    return this.userService.approveTenant(id, approveTenantDto);
  }

  // Super Admin Tenant Management Endpoints
  @Post('tenants')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new tenant (Super Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully',
    type: TenantDetailResponseDto,
  })
  async createTenant(
    @Body() createTenantDto: CreateTenantDto,
  ): Promise<TenantDetailResponseDto> {
    return this.userService.createTenant(createTenantDto);
  }

  @Get('stats')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get general user statistics (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
  })
  async getUserStats(): Promise<{
    totalUsers: number;
    totalTenants: number;
    totalOrgAdmins: number;
    totalSuperAdmins: number;
    activeUsers: number;
    inactiveUsers: number;
    recentRegistrations: number;
  }> {
    return this.userService.getUserStats();
  }

  @Get('tenants')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all tenants (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenants retrieved successfully',
    type: PaginatedResponseDto<TenantDetailResponseDto>,
  })
  async getAllTenants(
    @Query() filterDto: TenantFilterDto,
  ): Promise<PaginatedResponseDto<TenantDetailResponseDto>> {
    return this.userService.getAllTenants(filterDto);
  }

  @Get('tenants/stats')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get tenant statistics (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant statistics retrieved successfully',
  })
  async getTenantStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byCooperative: Array<{
      cooperativeId: string;
      cooperativeName: string;
      count: number;
    }>;
    recentRegistrations: number;
  }> {
    return this.userService.getTenantStats();
  }

  @Get('tenants/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get tenant by ID (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant retrieved successfully',
    type: TenantDetailResponseDto,
  })
  async getTenantById(
    @Param('id') id: string,
  ): Promise<TenantDetailResponseDto> {
    return this.userService.getTenantById(id);
  }

  @Patch('tenants/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update tenant (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant updated successfully',
    type: TenantDetailResponseDto,
  })
  async updateTenant(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ): Promise<TenantDetailResponseDto> {
    return this.userService.updateTenant(id, updateTenantDto);
  }

  @Delete('tenants/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Delete tenant (Super Admin only)',
    description: 'Soft delete if tenant has payments, hard delete otherwise',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant deleted successfully',
  })
  async deleteTenant(@Param('id') id: string): Promise<{ message: string }> {
    await this.userService.deleteTenant(id);
    return { message: 'Tenant deleted successfully' };
  }
}
