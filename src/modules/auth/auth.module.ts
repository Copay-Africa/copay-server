import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './presentation/auth.controller';
import { AccountRequestController } from './presentation/account-request.controller';
import { AuthService } from './application/auth.service';
import { AccountRequestService } from './application/account-request.service';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsModule } from '../sms/sms.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    PassportModule,
    SmsModule,
    ActivityModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AccountRequestController],
  providers: [AuthService, AccountRequestService, JwtStrategy, PrismaService],
  exports: [AuthService, AccountRequestService, JwtModule],
})
export class AuthModule {}
