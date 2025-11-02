import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './application/notification.service';
import { FcmService } from './infrastructure/fcm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../sms/application/sms.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificationService, FcmService, PrismaService, SmsService],
  exports: [NotificationService, FcmService],
})
export class NotificationModule {}
