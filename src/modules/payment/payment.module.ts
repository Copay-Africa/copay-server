import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Application Services
import { PaymentTypeService } from './application/payment-type.service';
import { PaymentService } from './application/payment.service';

// Infrastructure Services
import { PaymentCacheService } from './infrastructure/payment-cache.service';
import { PaymentGatewayFactory } from './infrastructure/payment-gateway.factory';
import { IrremboPayGateway } from './infrastructure/irembopay.gateway';

// Controllers
import { PaymentTypeController } from './presentation/payment-type.controller';
import { PaymentController } from './presentation/payment.controller';
import { PaymentWebhookController } from './presentation/payment-webhook.controller';

// Activity Module
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  controllers: [
    PaymentTypeController,
    PaymentController,
    PaymentWebhookController,
  ],
  providers: [
    // Core Services
    PrismaService,

    // Application Services
    PaymentTypeService,
    PaymentService,

    // Infrastructure Services
    PaymentCacheService,
    PaymentGatewayFactory,
    IrremboPayGateway,
  ],
  exports: [
    PaymentTypeService,
    PaymentService,
    PaymentCacheService,
    PaymentGatewayFactory,
  ],
})
export class PaymentModule {}
