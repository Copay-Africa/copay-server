import { Module } from '@nestjs/common';

import { ReminderService } from './application/reminder.service';
import { NotificationService } from './application/notification.service';
import { ReminderSchedulerService } from './infrastructure/reminder-scheduler.service';
import { ReminderController } from './presentation/reminder.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsModule } from '../sms/sms.module';
import { UserModule } from '../user/user.module';
import { CooperativeModule } from '../cooperative/cooperative.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    SmsModule,
    UserModule,
    CooperativeModule,
    PaymentModule,
  ],
  controllers: [ReminderController],
  providers: [ReminderService, NotificationService, ReminderSchedulerService, PrismaService],
  exports: [ReminderService, NotificationService],
})
export class ReminderModule {}
