import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get('redis');

        return {
          store: redisStore as any,
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          ttl: 300, // 5 minutes default TTL
          max: 1000, // maximum number of items in cache

          // Redis-specific options
          db: 0, // Use database 0
          keyPrefix: 'copay:', // Prefix all keys with 'copay:'

          // Connection options
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [CacheModule],
})
export class CacheConfigModule {}
