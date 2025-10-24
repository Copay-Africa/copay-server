import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        const nodeEnv = configService.get('app.nodeEnv') as string;

        // In serverless environments (like Vercel), use in-memory cache
        if (nodeEnv === 'production' && process.env.VERCEL) {
          return {
            ttl: 300, // 5 minutes default TTL
            max: 100, // Reduced for serverless memory constraints
          };
        }

        // For development or environments with Redis available
        try {
          const { redisStore } = await import('cache-manager-redis-store');

          return {
            store: redisStore as any,
            host: redisConfig?.host || 'localhost',
            port: redisConfig?.port || 6379,
            password: redisConfig?.password,
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
            connectTimeout: 5000, // 5 second timeout
            commandTimeout: 3000, // 3 second command timeout
          };
        } catch (error: any) {
          console.warn(
            'Redis not available, falling back to memory cache:',
            error?.message || 'Unknown error',
          );
          return {
            ttl: 300, // 5 minutes default TTL
            max: 100, // Reduced for memory constraints
          };
        }
      },
      inject: [ConfigService],
    }),
  ],
  exports: [CacheModule],
})
export class CacheConfigModule {}
