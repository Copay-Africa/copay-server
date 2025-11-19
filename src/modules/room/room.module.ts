import { Module } from '@nestjs/common';
import { RoomService } from './application/room.service';
import { RoomController } from './presentation/room.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [RoomController],
  providers: [RoomService, PrismaService],
  exports: [RoomService],
})
export class RoomModule {}
