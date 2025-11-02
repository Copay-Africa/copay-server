import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from './shared/decorators/auth.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private configService: ConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      version: '1.0.0',
      database: {
        connected: !!process.env.DATABASE_URL,
      },
      firebase: {
        configured: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
        projectId: process.env.FIREBASE_PROJECT_ID || 'not-set',
      },
    };
  }

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Configuration check' })
  getConfig() {
    return {
      nodeEnv: this.configService.get('NODE_ENV'),
      port: this.configService.get('PORT'),
      apiPrefix: this.configService.get('app.apiPrefix'),
      databaseUrl: this.configService.get('database.url') ? 'configured' : 'missing',
      jwtSecret: this.configService.get('jwt.secret') ? 'configured' : 'missing',
      firebaseProjectId: this.configService.get('firebase.projectId') || 'missing',
      firebaseServiceAccount: this.configService.get('firebase.serviceAccountKey') ? 'configured' : 'missing',
    };
  }
}