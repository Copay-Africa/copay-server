import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountRequestService } from '../application/account-request.service';
import {
  CreateAccountRequestDto,
  AccountRequestResponseDto,
  ProcessAccountRequestDto,
  AccountRequestStatsDto,
} from './dto/account-request.dto';
import { Public, Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { AccountRequestStatus, UserRole } from '@prisma/client';

@ApiTags('Account Requests')
@Controller('account-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AccountRequestController {
  constructor(private accountRequestService: AccountRequestService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit account request',
    description: 'Submit a new account request for a cooperative',
  })
  @ApiResponse({
    status: 201,
    description: 'Account request submitted successfully',
    type: AccountRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - phone number or room already exists',
  })
  async createAccountRequest(
    @Body() createAccountRequestDto: CreateAccountRequestDto,
  ): Promise<AccountRequestResponseDto> {
    return this.accountRequestService.createAccountRequest(
      createAccountRequestDto,
    );
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get all account requests',
    description:
      'Get all account requests with role-based filtering (Admin only)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AccountRequestStatus,
    description: 'Filter by request status',
  })
  @ApiQuery({
    name: 'cooperativeId',
    required: false,
    description: 'Filter by cooperative ID (Super admin only)',
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
  @ApiResponse({
    status: 200,
    description: 'Account requests retrieved successfully',
  })
  async getAccountRequests(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('status') status?: AccountRequestStatus,
    @Query('cooperativeId') cooperativeId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.accountRequestService.getAccountRequests(
      status,
      cooperativeId,
      page,
      limit,
      currentUser.role,
      currentUser.cooperativeId,
    );
  }

  @Get('organization/account-requests')
  @Roles('ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get organization account requests (organization admin only)',
  })
  @ApiQuery({ name: 'status', required: false, enum: AccountRequestStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Organization account requests retrieved successfully',
  })
  async getOrganizationAccountRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: AccountRequestStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!user.cooperativeId) {
      throw new BadRequestException(
        'Organization admin must be associated with a cooperative',
      );
    }

    return this.accountRequestService.getOrganizationAccountRequests(
      user.cooperativeId,
      status,
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
    );
  }

  @Get('admin/account-requests')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all account requests (super admin only)' })
  @ApiQuery({ name: 'cooperativeId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: AccountRequestStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'All account requests retrieved successfully',
  })
  async getAdminAccountRequests(
    @Query('cooperativeId') cooperativeId?: string,
    @Query('status') status?: AccountRequestStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.accountRequestService.getAccountRequests(
      status,
      cooperativeId,
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
      'SUPER_ADMIN',
      undefined,
    );
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({ summary: 'Get account requests statistics' })
  @ApiResponse({
    status: 200,
    description: 'Account requests statistics retrieved successfully',
  })
  async getAccountRequestStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cooperativeId') cooperativeId?: string,
  ) {
    return this.accountRequestService.getAccountRequestStats(
      cooperativeId,
      user.role,
      user.cooperativeId,
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Get account request by ID',
    description: 'Get a specific account request by ID (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Account request ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Account request retrieved successfully',
    type: AccountRequestResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Account request not found',
  })
  async getAccountRequestById(
    @Param('id') id: string,
  ): Promise<AccountRequestResponseDto> {
    return this.accountRequestService.getAccountRequestById(id);
  }

  @Put(':id/process')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @ApiOperation({
    summary: 'Process account request',
    description: 'Approve or reject an account request (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Account request ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Account request processed successfully',
    type: AccountRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or already processed',
  })
  @ApiResponse({
    status: 404,
    description: 'Account request not found',
  })
  async processAccountRequest(
    @Param('id') id: string,
    @Body() processDto: ProcessAccountRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AccountRequestResponseDto> {
    return this.accountRequestService.processAccountRequest(
      id,
      processDto,
      currentUser.id,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORGANIZATION_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete account request',
    description: 'Delete an account request (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Account request ID',
  })
  @ApiResponse({
    status: 204,
    description: 'Account request deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Account request not found',
  })
  async deleteAccountRequest(@Param('id') id: string): Promise<void> {
    return this.accountRequestService.deleteAccountRequest(id);
  }

  @Public()
  @Get('cooperative/:cooperativeId/check')
  @ApiOperation({
    summary: 'Check if phone/room is available',
    description:
      'Check if a phone number or room is available in a cooperative',
  })
  @ApiParam({
    name: 'cooperativeId',
    description: 'Cooperative ID',
  })
  @ApiQuery({
    name: 'phone',
    required: false,
    description: 'Phone number to check',
  })
  @ApiQuery({
    name: 'roomNumber',
    required: false,
    description: 'Room number to check',
  })
  @ApiResponse({
    status: 200,
    description: 'Availability check completed',
  })
  async checkAvailability(
    @Param('cooperativeId') cooperativeId: string,
    @Query('phone') phone?: string,
    @Query('roomNumber') roomNumber?: string,
  ): Promise<{
    phoneAvailable?: boolean;
    roomAvailable?: boolean;
    message: string;
  }> {
    // This would be implemented in the service
    // For now, returning a simple response
    return {
      phoneAvailable: true,
      roomAvailable: true,
      message: 'Availability check completed',
    };
  }
}
