import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  constructor(private configService: ConfigService) {}

  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const startTime = Date.now();
    const userAgent = req.headers['user-agent'] || '';
    const ip = this.getClientIp(req);
    const method = req.method;
    const url = req.url;

    // Security headers
    this.setSecurityHeaders(res);

    // Log security events
    this.logSecurityEvent(req, ip, userAgent);

    // Check for malicious patterns
    if (this.containsMaliciousPattern(req)) {
      this.logger.warn(
        `Malicious request detected from ${ip}: ${method} ${url}`,
      );
      res.code(400).send({ error: 'Bad Request' });
      return;
    }

    // Check rate limiting flags (handled by ThrottlerModule)
    res.header('X-Request-ID', this.generateRequestId());

    // Track response time
    res.header('X-Response-Time', `${Date.now() - startTime}ms`);

    next();
  }

  private setSecurityHeaders(res: FastifyReply) {
    // Security headers for additional protection
    res.header('X-Frame-Options', 'DENY');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('X-Permitted-Cross-Domain-Policies', 'none');
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Resource-Policy', 'same-origin');

    // Remove server information
    res.removeHeader('x-powered-by');
    res.removeHeader('server');
  }

  private getClientIp(req: FastifyRequest): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const cfConnectingIp = req.headers['cf-connecting-ip'] as string;

    // Check multiple headers for real IP (considering proxies)
    return (
      cfConnectingIp ||
      realIp ||
      (forwarded ? forwarded.split(',')[0].trim() : '') ||
      req.ip ||
      'unknown'
    );
  }

  private containsMaliciousPattern(req: FastifyRequest): boolean {
    const suspiciousPatterns = [
      // SQL Injection patterns
      /(union|select|insert|delete|drop|create|alter|exec|script)/i,
      // XSS patterns
      /<script|javascript:|onload=|onerror=/i,
      // Path traversal
      /\.\.\//,
      // Command injection
      /[;&|`$()]/,
      // Null bytes
      /%00/,
    ];

    const url = decodeURIComponent(req.url);
    const userAgent = req.headers['user-agent'] || '';

    // Check URL for malicious patterns
    if (suspiciousPatterns.some((pattern) => pattern.test(url))) {
      return true;
    }

    // Check user agent for bot patterns (optional - be careful not to block legitimate crawlers)
    const botPatterns = [/sqlmap/i, /nikto/i, /nessus/i, /masscan/i, /nmap/i];

    if (botPatterns.some((pattern) => pattern.test(userAgent))) {
      return true;
    }

    return false;
  }

  private logSecurityEvent(req: FastifyRequest, ip: string, userAgent: string) {
    if (this.configService.get('security.api.logRequests')) {
      this.logger.log({
        type: 'request',
        method: req.method,
        url: req.url,
        ip,
        userAgent: userAgent.substring(0, 200), // Truncate long user agents
        timestamp: new Date().toISOString(),
      });
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
