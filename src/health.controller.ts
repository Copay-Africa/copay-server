import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { PerformanceMonitoringService } from './shared/services/performance-monitoring.service';
import { EnhancedCacheService } from './shared/services/enhanced-cache.service';
import { Public } from './shared/decorators/auth.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
    private performanceService: PerformanceMonitoringService,
    private cacheService: EnhancedCacheService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async getHealth() {
    try {
      // Test database connection
      await this.prismaService.user.findFirst({ take: 1 });

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
        database: {
          connected: true,
        },
        firebase: {
          configured: !!(
            process.env.FIREBASE_PROJECT_ID &&
            process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY &&
            process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL
          ),
          projectId: process.env.FIREBASE_PROJECT_ID || 'not-set',
          serviceAccountEmail:
            process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL || 'not-set',
          privateKeyConfigured:
            !!process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        database: {
          connected: false,
        },
      };
    }
  }

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Configuration check' })
  getConfig() {
    const firebaseServiceAccount = this.configService.get(
      'firebase.serviceAccount',
    );
    return {
      nodeEnv: this.configService.get('NODE_ENV'),
      port: this.configService.get('PORT'),
      apiPrefix: this.configService.get('app.apiPrefix'),
      databaseUrl: this.configService.get('database.url')
        ? 'configured'
        : 'missing',
      jwtSecret: this.configService.get('jwt.secret')
        ? 'configured'
        : 'missing',
      firebaseProjectId:
        this.configService.get('firebase.projectId') || 'missing',
      firebaseServiceAccount:
        firebaseServiceAccount && firebaseServiceAccount.private_key
          ? 'configured'
          : 'missing',
      firebaseServiceAccountEmail:
        firebaseServiceAccount?.client_email || 'missing',
    };
  }

  @Public()
  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health and performance metrics' })
  async getDetailedHealth() {
    try {
      const healthStatus = this.performanceService.getHealthStatus();
      const metrics = this.performanceService.getMetrics();
      const cacheStats = this.cacheService.getStats();

      return {
        ...healthStatus,
        metrics,
        cache: cacheStats,
        database: {
          connected: true,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Public()
  @Get('performance')
  @ApiOperation({ summary: 'Performance metrics only' })
  async getPerformanceMetrics() {
    return this.performanceService.getMetrics();
  }

  @Public()
  @Get('cache')
  @ApiOperation({ summary: 'Cache statistics' })
  async getCacheStats() {
    return this.cacheService.getStats();
  }
}
