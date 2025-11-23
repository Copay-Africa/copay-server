import { registerAs } from '@nestjs/config';

export const securityConfig = registerAs('security', () => ({
  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },

  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // CORS Security
  cors: {
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400, // 24 hours for preflight cache
  },

  // Rate Limiting - Enhanced Security
  rateLimit: {
    // Global rate limiting
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
    },

    // Authentication endpoints - stricter limits
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per 15 minutes
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
    },

    // API endpoints - moderate limits
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per 15 minutes
      standardHeaders: true,
      legacyHeaders: false,
    },

    // Public endpoints - loose limits
    public: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 300, // 300 requests per 15 minutes
      standardHeaders: true,
      legacyHeaders: false,
    },
  },

  // Input validation and sanitization
  validation: {
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: process.env.NODE_ENV === 'production',
    validationError: {
      target: false,
      value: false,
    },
  },

  // Session security
  session: {
    secret: process.env.SESSION_SECRET || 'default-session-secret-change-me',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'strict',
  },

  // File upload security
  fileUpload: {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 5, // Maximum 5 files
    },
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
    ],
  },

  // Security headers
  headers: {
    // Remove server information
    hidePoweredBy: true,

    // Prevent MIME sniffing
    noSniff: true,

    // Frame options
    frameguard: {
      action: 'deny',
    },

    // XSS Protection
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // Permissions Policy
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
    },
  },

  // Password security requirements
  password: {
    minLength: 4, // PIN is 4-6 digits for mobile-first design
    maxLength: 6,
    requireNumbers: true,
    // Mobile-friendly: only numbers for PIN
  },

  // JWT Security
  jwt: {
    issuer: 'copay-backend',
    audience: 'copay-app',
    clockTolerance: 30, // 30 seconds tolerance
    algorithms: ['HS256'],
  },

  // API Security
  api: {
    // Request timeout
    timeout: 30000, // 30 seconds

    // Maximum request size
    maxRequestSize: '10mb',

    // Enable request logging in production
    logRequests: process.env.NODE_ENV === 'production',

    // Trusted proxies (for Vercel and similar platforms)
    trustedProxies: [
      '127.0.0.1',
      '::1',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
    ],
  },
}));
