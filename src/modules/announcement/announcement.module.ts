import { Module } from '@nestjs/common';
import { AnnouncementController } from './presentation/announcement.controller';
import { AnnouncementService } from './application/announcement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [AnnouncementController],
  providers: [AnnouncementService, PrismaService],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
