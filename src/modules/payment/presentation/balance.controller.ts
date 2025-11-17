import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BalanceService } from '../application/balance.service';
import {
  CooperativeBalanceDto,
  CopayBalanceDto,
  BalanceOverviewDto,
  PaymentCalculationDto,
} from './dto/balance.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Balance Management')
@Controller('balances')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  @Get('overview')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Get global balance overview',
    description: 'Get comprehensive balance statistics for admin dashboard (Super Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Global balance overview retrieved successfully',
    type: BalanceOverviewDto,
  })
  async getGlobalOverview(): Promise<BalanceOverviewDto> {
    return this.balanceService.getGlobalBalanceOverview();
  }

  @Get('cooperative/:cooperativeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  @ApiOperation({ 
    summary: 'Get cooperative balance details',
    description: 'Get balance information and statistics for a specific cooperative'
  })
  @ApiParam({
    name: 'cooperativeId',
    description: 'Cooperative ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Cooperative balance retrieved successfully',
  })
  async getCooperativeBalance(
    @Param('cooperativeId') cooperativeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Organization admins can only view their own cooperative balance
    if (user.role === UserRole.ORGANIZATION_ADMIN && user.cooperativeId !== cooperativeId) {
      throw new BadRequestException('You can only view your own cooperative balance');
    }

    return this.balanceService.getCooperativeBalanceStats(cooperativeId);
  }

  @Get('copay')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Get CoPay profit balance',
    description: 'Get CoPay fee collection balance and statistics (Super Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'CoPay balance retrieved successfully',
  })
  async getCopayBalance() {
    return this.balanceService.getCopayBalanceStats();
  }

  @Get('calculate')
  @ApiOperation({ 
    summary: 'Calculate payment with fees',
    description: 'Calculate total payment amount including transaction fees'
  })
  @ApiQuery({
    name: 'amount',
    description: 'Base payment amount',
    example: 50000,
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment calculation completed successfully',
    type: PaymentCalculationDto,
  })
  async calculatePaymentAmount(
    @Query('amount') amount: string,
  ): Promise<PaymentCalculationDto> {
    const baseAmount = parseFloat(amount);
    
    if (isNaN(baseAmount) || baseAmount <= 0) {
      throw new BadRequestException('Valid amount is required');
    }

    return this.balanceService.calculateTotalAmount(baseAmount);
  }

  @Get('cooperatives')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'List all cooperative balances',
    description: 'Get summary of all cooperative balances (Super Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Cooperative balances retrieved successfully',
  })
  async getAllCooperativeBalances() {
    // This would be useful for the admin dashboard to show all cooperative balances
    // For now, we'll return a simple implementation
    return {
      message: 'Feature coming soon - List all cooperative balances',
      note: 'Use the global overview endpoint for now',
    };
  }
}