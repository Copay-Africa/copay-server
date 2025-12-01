import { Module } from '@nestjs/common';
import { UserController } from './presentation/user.controller';
import { UserService } from './application/user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EnhancedCacheService } from '../../shared/services/enhanced-cache.service';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [SmsModule],
  controllers: [UserController],
  providers: [UserService, PrismaService, EnhancedCacheService],
  exports: [UserService],
})
export class UserModule {}
