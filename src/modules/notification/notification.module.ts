import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './application/notification.service';
import { FcmService } from './infrastructure/fcm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [ConfigModule, SmsModule],
  providers: [NotificationService, FcmService, PrismaService],
  exports: [NotificationService, FcmService],
})
export class NotificationModule {}
