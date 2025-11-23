import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  constructor(private performanceService: PerformanceMonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const { method, url } = request;
    const userAgent = request.headers['user-agent'] || '';
    const ip = this.getClientIp(request);

    // Set request start time for tracking
    (request as any).startTime = startTime;

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          this.performanceService.recordRequest(responseTime, false);

          // Log slow requests
          if (responseTime > 1000) {
            this.logger.warn({
              message: 'Slow request detected',
              method,
              url,
              responseTime: `${responseTime}ms`,
              ip,
              userAgent: userAgent.substring(0, 100),
            });
          }

          // Add performance headers
          response.header('X-Response-Time', `${responseTime}ms`);
          response.header('X-Request-ID', this.generateRequestId());
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          this.performanceService.recordRequest(responseTime, true);

          // Log error requests
          this.logger.error({
            message: 'Request error',
            method,
            url,
            responseTime: `${responseTime}ms`,
            error: error.message,
            ip,
            userAgent: userAgent.substring(0, 100),
          });

          // Add performance headers even for errors
          response.header('X-Response-Time', `${responseTime}ms`);
          response.header('X-Request-ID', this.generateRequestId());
        },
      }),
    );
  }

  private getClientIp(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIp = request.headers['x-real-ip'] as string;
    const cfConnectingIp = request.headers['cf-connecting-ip'] as string;

    return (
      cfConnectingIp ||
      realIp ||
      (forwarded ? forwarded.split(',')[0].trim() : '') ||
      request.ip ||
      'unknown'
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
