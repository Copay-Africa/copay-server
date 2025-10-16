import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class EnvironmentVariables {
  // Database
  @IsString()
  DATABASE_URL: string;

  // JWT
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string = '7d';

  // Redis
  @IsString()
  @IsOptional()
  REDIS_HOST?: string = 'localhost';

  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsOptional()
  REDIS_PORT?: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string = '';

  // App Configuration
  @IsString()
  @IsOptional()
  NODE_ENV?: string = 'development';

  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsOptional()
  PORT?: number = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX?: string = 'api/v1';

  // Rate Limiting
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsOptional()
  THROTTLE_TTL?: number = 60;

  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsOptional()
  THROTTLE_LIMIT?: number = 100;

  // CORS
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string = 'http://localhost:3000';

  // Features
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  ENABLE_COMPRESSION?: boolean = true;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  ENABLE_SWAGGER?: boolean = true;

  @IsString()
  @IsOptional()
  SWAGGER_PATH?: string = 'docs';
}
