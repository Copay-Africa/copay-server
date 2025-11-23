import { registerAs } from '@nestjs/config';

export const performanceConfig = registerAs('performance', () => ({
  // Caching Configuration
  cache: {
    // Default TTL for different types of data
    ttl: {
      user: 300, // 5 minutes for user data
      cooperative: 600, // 10 minutes for cooperative data
      room: 120, // 2 minutes for room data (frequently updated)
      payment: 60, // 1 minute for payment data
      notification: 30, // 30 seconds for notifications
      static: 3600, // 1 hour for static data
      lookup: 1800, // 30 minutes for lookup tables
      session: 900, // 15 minutes for session data
    },

    // Cache key prefixes
    prefixes: {
      user: 'user:',
      cooperative: 'coop:',
      room: 'room:',
      payment: 'pay:',
      notification: 'notif:',
      session: 'session:',
      lookup: 'lookup:',
      api: 'api:',
    },

    // Redis configuration for performance
    redis: {
      keyPrefix: 'copay:',
      retryDelayOnFailover: 50,
      enableReadyCheck: true,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 3000,
      commandTimeout: 2000,
      // Connection pooling
      keepAlive: 30000,
      family: 4, // IPv4
      // Memory optimization
      maxMemoryPolicy: 'allkeys-lru',
    },
  },

  // Database Performance
  database: {
    // Connection pooling
    pool: {
      min: 0,
      max: process.env.NODE_ENV === 'production' ? 10 : 5,
      idle: 20000, // 20 seconds
      acquire: 30000, // 30 seconds
      evict: 1000, // 1 second
    },

    // Query optimization
    query: {
      timeout: 10000, // 10 seconds
      limit: 1000, // Default query limit
      batchSize: 100, // Batch processing size
    },

    // Pagination defaults
    pagination: {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    },
  },

  // API Response Optimization
  api: {
    // Compression settings
    compression: {
      threshold: 1024, // Compress responses > 1KB
      level: 6, // Compression level (1-9, 6 is balanced)
      chunkSize: 1024,
      windowBits: 13,
      memLevel: 7,
    },

    // Response caching
    responseCache: {
      // Cache GET requests for public endpoints
      publicEndpoints: true,
      // Cache duration for different response types
      duration: {
        list: 60, // 1 minute for list responses
        detail: 300, // 5 minutes for detail responses
        static: 3600, // 1 hour for static responses
      },
    },

    // Request optimization
    request: {
      bodyParser: {
        json: { limit: '10mb' },
        urlencoded: { limit: '10mb', extended: true },
      },

      // Keep-alive settings
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
    },
  },

  // Memory Management
  memory: {
    // Garbage collection (when available)
    gc: {
      enabled: process.env.NODE_ENV === 'production',
      interval: 30000, // 30 seconds
      threshold: 0.8, // 80% memory usage
    },

    // Memory limits
    limits: {
      heapWarning: process.env.NODE_ENV === 'production' ? 0.8 : 0.9,
      maxOldSpaceSize: process.env.NODE_ENV === 'production' ? 512 : 256, // MB
    },
  },

  // Background Tasks
  tasks: {
    // Cleanup intervals
    cleanup: {
      expiredSessions: '0 */15 * * * *', // Every 15 minutes
      orphanedData: '0 0 2 * * *', // Daily at 2 AM
      cacheCleanup: '0 */30 * * * *', // Every 30 minutes
      logCleanup: '0 0 1 * * *', // Daily at 1 AM
    },

    // Task concurrency
    concurrency: {
      max: 5,
      timeout: 30000, // 30 seconds
    },
  },

  // Monitoring and Metrics
  monitoring: {
    // Health check intervals
    healthCheck: {
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      retries: 3,
    },

    // Performance metrics collection
    metrics: {
      enabled: true,
      interval: 60000, // 1 minute
      retention: 86400000, // 24 hours
    },

    // Error tracking
    errorTracking: {
      enabled: true,
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    },
  },

  // CDN and Static Assets
  assets: {
    // Static asset caching
    static: {
      maxAge: 86400000, // 24 hours
      immutable: true,
      etag: true,
    },

    // Image optimization
    images: {
      quality: 85,
      progressive: true,
      format: 'webp',
    },
  },

  // Load Balancing (for multi-instance deployments)
  loadBalancing: {
    strategy: 'round-robin',
    healthCheckPath: '/health',
    timeout: 5000,
    retries: 2,
  },
}));
