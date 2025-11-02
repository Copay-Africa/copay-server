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

export const firebaseConfig = registerAs('firebase', () => {
  // Build service account object from individual environment variables
  const buildServiceAccount = () => {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || 
        !process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
      return null;
    }

    return {
      type: process.env.FIREBASE_SERVICE_ACCOUNT_TYPE || 'service_account',
      project_id: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
      private_key_id: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_ID,
      auth_uri: process.env.FIREBASE_SERVICE_ACCOUNT_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      token_uri: process.env.FIREBASE_SERVICE_ACCOUNT_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.FIREBASE_SERVICE_ACCOUNT_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_CERT_URL,
      universe_domain: process.env.FIREBASE_SERVICE_ACCOUNT_UNIVERSE_DOMAIN || 'googleapis.com',
    };
  };

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    serviceAccount: buildServiceAccount(),
  };
});
