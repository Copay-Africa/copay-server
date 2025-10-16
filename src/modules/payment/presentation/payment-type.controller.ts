import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentTypeService } from '../application/payment-type.service';
import { CreatePaymentTypeDto } from './dto/create-payment-type.dto';
import { PaymentTypeResponseDto } from './dto/payment-type-response.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Payment Types')
@Controller('payment-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentTypeController {
  constructor(private paymentTypeService: PaymentTypeService) {}

  @Post()
  @Roles('ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new payment type' })
  @ApiResponse({
    status: 201,
    description: 'Payment type created successfully',
    type: PaymentTypeResponseDto,
  })
  async create(
    @Body() createPaymentTypeDto: CreatePaymentTypeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaymentTypeResponseDto> {
    return this.paymentTypeService.create(
      createPaymentTypeDto,
      currentUser.cooperativeId!,
      currentUser.role as UserRole,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all payment types for current cooperative' })
  @ApiResponse({
    status: 200,
    description: 'Payment types retrieved successfully',
    type: PaginatedResponseDto<PaymentTypeResponseDto>,
  })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query('includeInactive') includeInactive: boolean = false,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<PaymentTypeResponseDto>> {
    return this.paymentTypeService.findAllByCooperative(
      currentUser.cooperativeId!,
      paginationDto,
      includeInactive,
    );
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get active payment types (optimized for USSD/mobile)',
    description:
      'Returns only active payment types, optimized with caching for USSD and mobile apps',
  })
  @ApiResponse({
    status: 200,
    description: 'Active payment types retrieved successfully',
    type: [PaymentTypeResponseDto],
  })
  async getActive(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaymentTypeResponseDto[]> {
    return this.paymentTypeService.getActivePaymentTypesForCache(
      currentUser.cooperativeId!,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment type by ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment type retrieved successfully',
    type: PaymentTypeResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaymentTypeResponseDto> {
    return this.paymentTypeService.findById(
      id,
      currentUser.cooperativeId!,
      currentUser.role as UserRole,
    );
  }

  @Patch(':id/status')
  @Roles('ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update payment type status' })
  @ApiResponse({
    status: 200,
    description: 'Payment type status updated successfully',
    type: PaymentTypeResponseDto,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaymentTypeResponseDto> {
    return this.paymentTypeService.updateStatus(
      id,
      isActive,
      currentUser.cooperativeId!,
      currentUser.role as UserRole,
    );
  }
}
