import { Module } from '@nestjs/common';
import { RoomService } from './application/room.service';
import { RoomController } from './presentation/room.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationModule } from '../notification/notification.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [NotificationModule, SmsModule],
  controllers: [RoomController],
  providers: [RoomService, PrismaService],
  exports: [RoomService],
})
export class RoomModule {}
