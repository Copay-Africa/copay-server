import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CooperativeModule } from './modules/cooperative/cooperative.module';
import { PaymentModule } from './modules/payment/payment.module';
import { UssdModule } from './modules/ussd/ussd.module';
import { RoomModule } from './modules/room/room.module';
import { SmsModule } from './modules/sms/sms.module';
import { ActivityModule } from './modules/activity/activity.module';
import { ReminderModule } from './modules/reminder/reminder.module';
import { ComplaintModule } from './modules/complaint/complaint.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { CooperativeCategoryModule } from './modules/cooperative-category/cooperative-category.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { EnhancedCacheService } from './shared/services/enhanced-cache.service';
import { PerformanceMonitoringService } from './shared/services/performance-monitoring.service';
import { PerformanceInterceptor } from './shared/interceptors/performance.interceptor';
import { CacheConfigModule } from './config/cache.module';
import {
  databaseConfig,
  jwtConfig,
  redisConfig,
  appConfig,
  rateLimitConfig,
  smsConfig,
  firebaseConfig,
} from './config/configuration';
import { securityConfig } from './config/security.config';
import { performanceConfig } from './config/performance.config';
import { validateConfig } from './config/config.validation';

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
        securityConfig,
        performanceConfig,
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
    CooperativeCategoryModule,
    PaymentModule,
    UssdModule,
    RoomModule,
    SmsModule,
    ActivityModule,
    ReminderModule,
    ComplaintModule,
    NotificationModule,
    AnnouncementModule,
    AnalyticsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    PrismaService,
    EnhancedCacheService,
    PerformanceMonitoringService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
  ],
})
export class AppModule {}
