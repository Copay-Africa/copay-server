import { Module } from '@nestjs/common';
import { ActivityService } from './application/activity.service';
import { ActivityController } from './presentation/activity.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ActivityController],
  providers: [ActivityService, PrismaService],
  exports: [ActivityService],
})
export class ActivityModule {}
