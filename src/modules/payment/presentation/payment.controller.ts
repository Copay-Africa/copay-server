import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentService } from '../application/payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentSearchDto } from './dto/payment-search.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { Roles } from '../../../shared/decorators/auth.decorator';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Post()
  @ApiOperation({
    summary: 'Initiate a payment',
    description:
      'Initiates a payment with idempotency support to prevent duplicates. Supports cross-cooperative payments by providing targetCooperativeId.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully',
    type: PaymentResponseDto,
  })
  async initiatePayment(
    @Body() initiatePaymentDto: InitiatePaymentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.initiatePayment(
      initiatePaymentDto,
      currentUser.id,
      initiatePaymentDto.targetCooperativeId || currentUser.cooperativeId!,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get payments',
    description:
      'Get payments based on user role - tenants see their own, admins see all in cooperative',
  })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
    type: PaginatedResponseDto<PaymentResponseDto>,
  })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<PaymentResponseDto>> {
    return this.paymentService.findAllByUser(
      currentUser.id,
      currentUser.cooperativeId!,
      paginationDto,
      currentUser.role as UserRole,
    );
  }

  @Get('search')
  @Roles(UserRole.TENANT, UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Search payments with advanced filters',
    description:
      'Search payments with comprehensive filtering options including amount range, dates, status, payment methods, etc. Role-based access applies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payments search results retrieved successfully',
    type: PaginatedResponseDto<PaymentResponseDto>,
  })
  async searchPayments(
    @Query() searchDto: PaymentSearchDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<PaymentResponseDto>> {
    if (!currentUser.cooperativeId) {
      throw new BadRequestException('User cooperative ID is required');
    }
    return this.paymentService.searchPayments(
      searchDto,
      currentUser.id,
      currentUser.cooperativeId,
      currentUser.role as UserRole,
    );
  }

  @Get('organization')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all payments for organization',
    description:
      'Organization admins can view all payments from their cooperative tenants with advanced filtering options',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization payments retrieved successfully',
    type: PaginatedResponseDto<PaymentResponseDto>,
  })
  async findOrganizationPayments(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('senderId') senderId?: string,
    @Query('paymentTypeId') paymentTypeId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<PaginatedResponseDto<PaymentResponseDto>> {
    return this.paymentService.findOrganizationPayments(
      currentUser.cooperativeId!,
      paginationDto,
      {
        status,
        paymentMethod,
        senderId,
        paymentTypeId,
        fromDate,
        toDate,
      },
      currentUser.role as UserRole,
    );
  }

  @Get('organization/stats')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get payment statistics for organization',
    description:
      'Get payment summary statistics for the organization including total amounts, payment counts, and status breakdown',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment statistics retrieved successfully',
  })
  async getOrganizationPaymentStats(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<any> {
    return this.paymentService.getOrganizationPaymentStats(
      currentUser.cooperativeId!,
      { fromDate, toDate },
    );
  }

  @Get('organization/:id')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get payment details for organization',
    description:
      'Organization admins can view detailed payment information including transaction history',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details retrieved successfully',
    type: PaymentResponseDto,
  })
  async findOrganizationPayment(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.findOrganizationPaymentById(
      id,
      currentUser.cooperativeId!,
      currentUser.role as UserRole,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment retrieved successfully',
    type: PaymentResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.findById(
      id,
      currentUser.id,
      currentUser.cooperativeId!,
      currentUser.role as UserRole,
    );
  }
}
