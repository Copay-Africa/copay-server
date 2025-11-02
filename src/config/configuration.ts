import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  enableCompression: process.env.ENABLE_COMPRESSION === 'true',
  enableSwagger: process.env.ENABLE_SWAGGER === 'true',
  swaggerPath: process.env.SWAGGER_PATH || 'docs',
}));

export const rateLimitConfig = registerAs('rateLimit', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL || '60'),
  limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
}));

export const smsConfig = registerAs('sms', () => ({
  fdi: {
    baseUrl:
      process.env.FDI_SMS_BASE_URL || 'https://messaging.fdibiz.com/api/v1',
    username: process.env.FDI_SMS_USERNAME || '',
    password: process.env.FDI_SMS_PASSWORD || '',
    senderId: process.env.FDI_SMS_SENDER_ID || 'COPAY',
    enabled: process.env.SMS_ENABLED === 'true',
  },
}));

export const firebaseConfig = registerAs('firebase', () => ({
  projectId: process.env.FIREBASE_PROJECT_ID,
  serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
}));
