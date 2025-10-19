import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import fastifyCompress from '@fastify/compress';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Memory optimization for production
  if (process.env.NODE_ENV === 'production') {
    // Force garbage collection more frequently
    if (global.gc) {
      setInterval(() => {
        global.gc();
      }, 30000); // Run GC every 30 seconds
    }
  }

  // Create Fastify app instance with memory-optimized settings
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.NODE_ENV === 'development',
      trustProxy: true,
      maxParamLength: 1000, // Limit parameter length
      bodyLimit: 1048576 * 10, // 10MB body limit
    }),
  );

  // Get config service
  const configService = app.get(ConfigService);

  // Enable CORS
  const corsOrigins = configService.get('app.corsOrigin');
  await app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Set global prefix
  const apiPrefix = configService.get('app.apiPrefix');
  app.setGlobalPrefix(apiPrefix);

  // Setup Swagger documentation
  if (configService.get('app.enableSwagger')) {
    setupSwagger(app);
    logger.log(
      `Swagger documentation: http://localhost:${configService.get('app.port')}/${configService.get('app.swaggerPath')}`,
    );
  }

  // Enable compression
  if (configService.get('app.enableCompression')) {
    await app.register(fastifyCompress);
  }

  // Start server
  const port = configService.get('app.port');
  await app.listen(port, '0.0.0.0');

  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(`📚 Environment: ${configService.get('app.nodeEnv')}`);
}

bootstrap().catch((err) => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});
