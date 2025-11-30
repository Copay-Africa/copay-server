import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  UseGuards,
  BadRequestException,
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
import { PaymentTypeSearchDto } from './dto/payment-type-search.dto';
import { PaymentTypeQueryDto } from './dto/payment-type-query.dto';
import { PaymentTypeActiveQueryDto } from './dto/payment-type-active-query.dto';
import { PaymentTypeOptionalQueryDto } from './dto/payment-type-optional-query.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles, Public } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Payment Types')
@Controller('payment-types')
export class PaymentTypeController {
  constructor(private paymentTypeService: PaymentTypeService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
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

  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Search payment types',
    description: 'Search payment types with advanced filtering options',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment types found successfully',
    type: PaginatedResponseDto<PaymentTypeResponseDto>,
  })
  async searchPaymentTypes(
    @Query() searchDto: PaymentTypeSearchDto,
  ): Promise<PaginatedResponseDto<PaymentTypeResponseDto>> {
    if (!searchDto.cooperativeId) {
      throw new BadRequestException('Cooperative ID is required');
    }
    return this.paymentTypeService.searchPaymentTypes(searchDto);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all payment types for specified cooperative',
    description: 'Public endpoint to get payment types by cooperative ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment types retrieved successfully',
    type: PaginatedResponseDto<PaymentTypeResponseDto>,
  })
  async findAll(
    @Query() queryDto: PaymentTypeQueryDto,
  ): Promise<PaginatedResponseDto<PaymentTypeResponseDto>> {
    return this.paymentTypeService.findAllByCooperative(
      queryDto.cooperativeId,
      queryDto,
      queryDto.includeInactive,
    );
  }

  @Get('active')
  @Public()
  @ApiOperation({
    summary: 'Get active payment types (optimized for USSD/mobile)',
    description:
      'Public endpoint returning only active payment types, optimized with caching for USSD and mobile apps',
  })
  @ApiResponse({
    status: 200,
    description: 'Active payment types retrieved successfully',
    type: [PaymentTypeResponseDto],
  })
  async getActive(
    @Query() queryDto: PaymentTypeActiveQueryDto,
  ): Promise<PaymentTypeResponseDto[]> {
    return this.paymentTypeService.getActivePaymentTypesForCache(queryDto.cooperativeId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get payment type by ID',
    description: 'Public endpoint to get a specific payment type by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment type retrieved successfully',
    type: PaymentTypeResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @Query() queryDto: PaymentTypeOptionalQueryDto,
  ): Promise<PaymentTypeResponseDto> {
    return await this.paymentTypeService.findByIdPublic(id, queryDto.cooperativeId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZATION_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
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
