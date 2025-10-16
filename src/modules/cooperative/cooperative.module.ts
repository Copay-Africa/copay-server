import { Module } from '@nestjs/common';
import { CooperativeController } from './presentation/cooperative.controller';
import { CooperativeService } from './application/cooperative.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [CooperativeController],
  providers: [CooperativeService, PrismaService],
  exports: [CooperativeService],
})
export class CooperativeModule {}
