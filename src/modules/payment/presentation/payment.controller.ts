import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
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
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

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
      'Initiates a payment with idempotency support to prevent duplicates',
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
      currentUser.cooperativeId!,
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
