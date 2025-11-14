import { Module } from '@nestjs/common';
import { ComplaintController } from './presentation/complaint.controller';
import { ComplaintService } from './application/complaint.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [ActivityModule, NotificationModule],
  controllers: [ComplaintController],
  providers: [ComplaintService, PrismaService],
  exports: [ComplaintService],
})
export class ComplaintModule {}
