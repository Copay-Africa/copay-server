import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EnhancedCacheService } from './enhanced-cache.service';

interface PerformanceMetrics {
  memory: NodeJS.MemoryUsage;
  uptime: number;
  responseTime: {
    average: number;
    min: number;
    max: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  requests: {
    total: number;
    perMinute: number;
    errors: number;
    errorRate: number;
  };
  timestamp: string;
}

@Injectable()
export class PerformanceMonitoringService {
  private readonly logger = new Logger(PerformanceMonitoringService.name);
  private readonly metrics = {
    requests: {
      total: 0,
      errors: 0,
      responseTimes: [] as number[],
      startTime: Date.now(),
    },
  };

  constructor(
    private configService: ConfigService,
    private cacheService: EnhancedCacheService,
  ) {
    this.startMonitoring();
  }

  /**
   * Record a request and its response time
   */
  recordRequest(responseTime: number, isError: boolean = false): void {
    this.metrics.requests.total++;
    this.metrics.requests.responseTimes.push(responseTime);

    if (isError) {
      this.metrics.requests.errors++;
    }

    // Keep only last 1000 response times to prevent memory leak
    if (this.metrics.requests.responseTimes.length > 1000) {
      this.metrics.requests.responseTimes =
        this.metrics.requests.responseTimes.slice(-1000);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const memory = process.memoryUsage();
    const uptime = process.uptime();
    const cacheStats = this.cacheService.getStats();

    const responseTimes = this.metrics.requests.responseTimes;
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    const minResponseTime =
      responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime =
      responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    const totalRequests = this.metrics.requests.total;
    const runtimeMinutes =
      (Date.now() - this.metrics.requests.startTime) / 60000;
    const requestsPerMinute =
      runtimeMinutes > 0 ? totalRequests / runtimeMinutes : 0;

    const errorRate =
      totalRequests > 0
        ? (this.metrics.requests.errors / totalRequests) * 100
        : 0;

    return {
      memory,
      uptime,
      responseTime: {
        average: Math.round(avgResponseTime * 100) / 100,
        min: Math.round(minResponseTime * 100) / 100,
        max: Math.round(maxResponseTime * 100) / 100,
      },
      cache: cacheStats,
      requests: {
        total: totalRequests,
        perMinute: Math.round(requestsPerMinute * 100) / 100,
        errors: this.metrics.requests.errors,
        errorRate: Math.round(errorRate * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if system performance is healthy
   */
  isHealthy(): boolean {
    const memory = process.memoryUsage();
    const metrics = this.getMetrics();

    const memoryConfig = this.configService.get('performance.memory.limits');
    const maxHeap = (memoryConfig?.maxOldSpaceSize || 512) * 1024 * 1024; // Convert MB to bytes
    const warningThreshold = memoryConfig?.heapWarning || 0.8;

    // Check memory usage
    if (memory.heapUsed > maxHeap * warningThreshold) {
      this.logger.warn(
        `High memory usage: ${Math.round((memory.heapUsed / maxHeap) * 100)}%`,
      );
      return false;
    }

    // Check error rate
    if (metrics.requests.errorRate > 5) {
      // More than 5% error rate
      this.logger.warn(`High error rate: ${metrics.requests.errorRate}%`);
      return false;
    }

    // Check response time
    if (metrics.responseTime.average > 5000) {
      // More than 5 seconds average
      this.logger.warn(`High response time: ${metrics.responseTime.average}ms`);
      return false;
    }

    return true;
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    const monitoringConfig = this.configService.get('performance.monitoring');

    if (!monitoringConfig?.enabled) {
      return;
    }

    // Log metrics every minute
    setInterval(() => {
      const metrics = this.getMetrics();
      this.logger.debug('Performance Metrics:', {
        memory: `${Math.round(metrics.memory.heapUsed / 1024 / 1024)}MB`,
        uptime: `${Math.round(metrics.uptime)}s`,
        avgResponseTime: `${metrics.responseTime.average}ms`,
        requestsPerMinute: metrics.requests.perMinute,
        cacheHitRate: `${Math.round(metrics.cache.hitRate)}%`,
        errorRate: `${metrics.requests.errorRate}%`,
      });
    }, monitoringConfig.interval || 60000);
  }

  /**
   * Cleanup old metrics data - runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  private cleanupMetrics(): void {
    const maxResponseTimes = 100;
    if (this.metrics.requests.responseTimes.length > maxResponseTimes) {
      this.metrics.requests.responseTimes =
        this.metrics.requests.responseTimes.slice(-maxResponseTimes);
    }

    this.logger.debug('Metrics cleanup completed');
  }

  /**
   * Force garbage collection if available - runs every 30 minutes
   */
  @Cron('0 */30 * * * *')
  private async performanceOptimization(): Promise<void> {
    const gcConfig = this.configService.get('performance.memory.gc');

    if (!gcConfig?.enabled) {
      return;
    }

    const memory = process.memoryUsage();
    const threshold = gcConfig.threshold || 0.8;
    const maxHeap =
      (this.configService.get('performance.memory.limits.maxOldSpaceSize') ||
        512) *
      1024 *
      1024;

    if (memory.heapUsed > maxHeap * threshold) {
      this.logger.log(
        'Memory threshold reached, attempting garbage collection',
      );

      try {
        if (typeof (global as any).gc === 'function') {
          (global as any).gc();
          const newMemory = process.memoryUsage();
          this.logger.log(
            `GC completed. Memory usage: ${Math.round(memory.heapUsed / 1024 / 1024)}MB -> ${Math.round(newMemory.heapUsed / 1024 / 1024)}MB`,
          );
        }
      } catch (error) {
        this.logger.error('Garbage collection failed:', error);
      }
    }
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics.requests.total = 0;
    this.metrics.requests.errors = 0;
    this.metrics.requests.responseTimes = [];
    this.metrics.requests.startTime = Date.now();
    this.cacheService.resetStats();

    this.logger.log('Performance metrics reset');
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    details: any;
  } {
    const metrics = this.getMetrics();
    const memory = metrics.memory;
    const maxHeap =
      (this.configService.get('performance.memory.limits.maxOldSpaceSize') ||
        512) *
      1024 *
      1024;
    const memoryUsagePercent = (memory.heapUsed / maxHeap) * 100;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];

    // Check memory usage
    if (memoryUsagePercent > 90) {
      status = 'critical';
      issues.push(`Critical memory usage: ${Math.round(memoryUsagePercent)}%`);
    } else if (memoryUsagePercent > 80) {
      status = 'warning';
      issues.push(`High memory usage: ${Math.round(memoryUsagePercent)}%`);
    }

    // Check error rate
    if (metrics.requests.errorRate > 10) {
      status = 'critical';
      issues.push(`Critical error rate: ${metrics.requests.errorRate}%`);
    } else if (metrics.requests.errorRate > 5) {
      if (status === 'healthy') {
        status = 'warning';
      }
      issues.push(`High error rate: ${metrics.requests.errorRate}%`);
    }

    // Check response time
    if (metrics.responseTime.average > 10000) {
      status = 'critical';
      issues.push(`Critical response time: ${metrics.responseTime.average}ms`);
    } else if (metrics.responseTime.average > 5000) {
      if (status === 'healthy') {
        status = 'warning';
      }
      issues.push(`High response time: ${metrics.responseTime.average}ms`);
    }

    return {
      status,
      details: {
        metrics,
        issues,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
