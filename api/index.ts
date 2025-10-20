import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupSwagger } from '../src/config/swagger.config';

let app: NestFastifyApplication;

async function createApp() {
  if (app) {
    return app;
  }

  const logger = new Logger('Vercel');

  try {
    // Create Fastify app instance optimized for serverless
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: process.env.NODE_ENV === 'development',
        trustProxy: true,
        maxParamLength: 1000,
        bodyLimit: 1048576 * 10, // 10MB body limit
      }),
    );

    // Get config service
    const configService = app.get(ConfigService);

    // Connect to Prisma
    try {
      const prisma = app.get(PrismaService);
      if (prisma && typeof prisma.$connect === 'function') {
        await prisma.$connect();
      }
    } catch (err) {
      logger.error('PrismaService connection error', err);
    }

    // Enable CORS with more permissive settings for serverless
    await app.enableCors({
      origin: true, // Allow all origins in serverless
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
    const apiPrefix = configService.get('app.apiPrefix') || 'api/v1';
    app.setGlobalPrefix(apiPrefix);

    // Setup Swagger documentation
    if (configService.get('app.enableSwagger') !== false) {
      setupSwagger(app);
    }

    await app.init();
    logger.log('NestJS application initialized for Vercel');
    return app;
  } catch (error) {
    logger.error('Failed to create NestJS app:', error);
    throw error;
  }
}

// Export the handler for Vercel
export default async function handler(req: any, res: any) {
  try {
    const app = await createApp();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    
    // Ensure Fastify is ready
    await fastifyInstance.ready();
    
    // Handle the request
    fastifyInstance.server.emit('request', req, res);
  } catch (error) {
    console.error('Handler error:', error);
    
    // Ensure response headers are set correctly
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
      });
    }
  }
}