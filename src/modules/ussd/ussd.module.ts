import { Module } from '@nestjs/common';
import { UssdController } from './presentation/ussd.controller';
import { UssdService } from './application/ussd.service';
import { UserModule } from '../user/user.module';
import { CooperativeModule } from '../cooperative/cooperative.module';
import { PaymentModule } from '../payment/payment.module';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * USSD Module
 *
 * Provides USSD functionality for the Copay platform allowing tenants to:
 * - Make payments via USSD (*134#)
 * - Check payment history
 * - Get help and cooperative contact information
 *
 * Features:
 * - Session management with Redis caching
 * - PIN-based authentication
 * - Multi-cooperative support
 * - Integration with existing payment gateway (IremboPay)
 * - Telecom standard USSD responses (CON/END)
 *
 * Integration points:
 * - UserModule: User authentication and verification
 * - CooperativeModule: Cooperative selection and information
 * - PaymentModule: Payment processing via IremboPay gateway
 * - PrismaService: Database operations
 * - Redis Cache: Session state management
 */
@Module({
  imports: [
    UserModule, // For user authentication and management
    CooperativeModule, // For cooperative data and selection
    PaymentModule, // For payment processing integration
  ],
  controllers: [UssdController],
  providers: [
    UssdService,
    PrismaService, // Direct Prisma access for optimized queries
  ],
  exports: [UssdService], // Export service for potential future use
})
export class UssdModule {}
