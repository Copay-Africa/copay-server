import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CooperativeModule } from './modules/cooperative/cooperative.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import {
  databaseConfig,
  jwtConfig,
  redisConfig,
  appConfig,
  rateLimitConfig,
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

    // Caching
    CacheModule.register({
      ttl: 60, // 60 seconds default TTL
      max: 100, // maximum number of items in cache
      isGlobal: true,
    }),

    // Feature modules
    AuthModule,
    UserModule,
    CooperativeModule,
  ],
  controllers: [AppController],
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
