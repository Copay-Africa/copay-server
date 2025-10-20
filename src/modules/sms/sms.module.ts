import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './application/sms.service';
import { FdiSmsProvider } from './infrastructure/fdi-sms.provider';

@Module({
  imports: [ConfigModule],
  providers: [SmsService, FdiSmsProvider],
  exports: [SmsService],
})
export class SmsModule {}
