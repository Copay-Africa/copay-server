import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './application/notification.service';
import { FcmService } from './infrastructure/fcm.service';
import { NotificationGateway } from './infrastructure/notification.gateway';
import { NotificationController } from './presentation/notification.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [ConfigModule, SmsModule],
  controllers: [NotificationController],
  providers: [NotificationService, FcmService, NotificationGateway, PrismaService],
  exports: [NotificationService, FcmService, NotificationGateway],
})
export class NotificationModule implements OnModuleInit {
  constructor(
    private notificationService: NotificationService,
    private notificationGateway: NotificationGateway,
  ) {}

  onModuleInit() {
    // Set up the circular dependency after module initialization
    this.notificationService.setNotificationGateway(this.notificationGateway);
  }
}
