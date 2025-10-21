import { Module } from '@nestjs/common';
import {
  CooperativeController,
  PublicCooperativeController,
} from './presentation/cooperative.controller';
import { CooperativeService } from './application/cooperative.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [CooperativeController, PublicCooperativeController],
  providers: [CooperativeService, PrismaService],
  exports: [CooperativeService],
})
export class CooperativeModule {}
