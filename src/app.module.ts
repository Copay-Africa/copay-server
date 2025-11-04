import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CooperativeModule } from './modules/cooperative/cooperative.module';
import { PaymentModule } from './modules/payment/payment.module';
import { UssdModule } from './modules/ussd/ussd.module';
import { SmsModule } from './modules/sms/sms.module';
import { ActivityModule } from './modules/activity/activity.module';
import { ReminderModule } from './modules/reminder/reminder.module';
import { ComplaintModule } from './modules/complaint/complaint.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { CacheConfigModule } from './config/cache.module';
import {
  databaseConfig,
  jwtConfig,
  redisConfig,
  appConfig,
  rateLimitConfig,
  smsConfig,
  firebaseConfig,
  validateConfig,
} from './config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        jwtConfig,
        redisConfig,
        appConfig,
        rateLimitConfig,
        smsConfig,
        firebaseConfig,
      ],
      validate: validateConfig,
      envFilePath: ['.env'],
    }),

    // Rate limiting (throttling)
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000, // 1 second
            limit: 3,
          },
          {
            name: 'medium',
            ttl: 10000, // 10 seconds
            limit: 20,
          },
          {
            name: 'long',
            ttl: 60000, // 1 minute
            limit: 100,
          },
        ],
      }),
    }),

    // Redis Caching
    CacheConfigModule,

    // Task Scheduling
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    UserModule,
    CooperativeModule,
    PaymentModule,
    UssdModule,
    SmsModule,
    ActivityModule,
    ReminderModule,
    ComplaintModule,
    NotificationModule,
    AnnouncementModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
