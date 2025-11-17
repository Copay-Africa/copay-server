import { Module } from '@nestjs/common';
import { CooperativeCategoryController } from './presentation/cooperative-category.controller';
import { CooperativeCategoryService } from './application/cooperative-category.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [CooperativeCategoryController],
  providers: [CooperativeCategoryService, PrismaService],
  exports: [CooperativeCategoryService],
})
export class CooperativeCategoryModule {}