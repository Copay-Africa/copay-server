import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { setupSwagger } from './config/swagger.config';
import { SecurityMiddleware } from './shared/middlewares/security.middleware';
import fastifyCompress from '@fastify/compress';
import fastifyHelmet from '@fastify/helmet';
import fastifySocketIO from 'fastify-socket.io';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  if (process.env.NODE_ENV === 'production') {
    if (typeof (global as any).gc === 'function') {
      setInterval(() => {
        try {
          (global as any).gc();
        } catch (err) {
          // ignore if GC fails
        }
      }, 30000);
    }
  }

  // Create Fastify app instance with optimized settings
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.NODE_ENV === 'development',
      trustProxy: true,
      maxParamLength: 1000,
      bodyLimit: 1048576 * 10, // 10MB body limit
      ignoreTrailingSlash: true,
      caseSensitive: false,
      requestIdHeader: 'x-request-id',
      requestIdLogLabel: 'reqId',
    }),
  );

  const configService = app.get(ConfigService);

  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  try {
    const prisma = app.get(PrismaService);
    if (prisma && typeof prisma.$connect === 'function') {
      await prisma.$connect();
      logger.log('Database connection established');
    }
  } catch (err) {
    logger.error('PrismaService connection failed:', err);
    process.exit(1);
  }

  const corsConfig = configService.get('security.cors');
  const corsOrigins = configService.get('app.corsOrigin');

  await app.enableCors({
    origin: corsOrigins,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowedHeaders,
    credentials: corsConfig.credentials,
    optionsSuccessStatus: corsConfig.optionsSuccessStatus,
    maxAge: corsConfig.maxAge,
  });

  // TODO: Socket.IO setup - temporarily disabled for build
  // await app.register(fastifySocketIO, {
  //   cors: {
  //     origin: corsOrigins,
  //     methods: ['GET', 'POST'],
  //     credentials: true,
  //   },
  //   path: '/socket.io',
  //   serveClient: false,
  //   pingTimeout: 60000,
  //   pingInterval: 25000,
  //   transports: ['websocket', 'polling'],
  // });

  logger.log('Real-time notifications ready (WebSocket gateway available)');

  // Validation pipe with security configurations
  const validationConfig = configService.get('security.validation');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: validationConfig.whitelist,
      forbidNonWhitelisted: validationConfig.forbidNonWhitelisted,
      transform: validationConfig.transform,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: validationConfig.disableErrorMessages,
      validationError: validationConfig.validationError,
    }),
  );

  // Compression with optimized settings
  if (configService.get('app.enableCompression')) {
    const compressionConfig = configService.get('performance.api.compression');
    await app.register(fastifyCompress as any, {
      threshold: compressionConfig.threshold,
      global: true,
      encodings: ['gzip', 'deflate'],
    });
  }

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

  // Start server with timeout
  const port = configService.get('app.port');
  const timeout = configService.get('security.api.timeout') || 30000;

  await app.listen(port, '0.0.0.0');

  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
}

bootstrap().catch((err) => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});
