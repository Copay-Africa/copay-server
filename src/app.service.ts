import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): object {
    return {
      message: 'Co-Pay API is running!',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  getDetailedHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: 'connected', // Will be dynamic later
        redis: 'connected', // Will be dynamic later
      },
    };
  }
}
