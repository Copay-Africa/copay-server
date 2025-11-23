/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { LoginDto } from '../presentation/dto/login.dto';
import { LogoutDto } from '../presentation/dto/logout.dto';
import { AuthResponseDto } from '../presentation/dto/auth-response.dto';
import { ForgotPinDto } from '../presentation/dto/forgot-pin.dto';
import { ResetPinDto } from '../presentation/dto/reset-pin.dto';
import { ForgotPinResponseDto } from '../presentation/dto/forgot-pin-response.dto';
import { JwtPayload } from '../infrastructure/jwt.strategy';
import { SmsService } from '../../sms/application/sms.service';
import { ActivityService } from '../../activity/application/activity.service';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private smsService: SmsService,
    private activityService: ActivityService,
  ) {}

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { phone, pin, fcmToken } = loginDto;

    try {
      // Find user by phone
      const user = await this.prismaService.user.findUnique({
        where: { phone },
        include: { cooperative: true },
      });

      if (!user) {
        // Log failed login attempt
        await this.activityService.logFailedLogin(phone, 'User not found', {
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException('Invalid phone number or PIN');
      }

      // Check if user is active
      if (user.status !== 'ACTIVE') {
        // Log failed login attempt
        await this.activityService.logFailedLogin(phone, 'Account not active', {
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException('Account is not active');
      }

      // Verify PIN
      const isPinValid = await bcrypt.compare(pin, user.pin);
      if (!isPinValid) {
        // Log failed login attempt
        await this.activityService.logFailedLogin(phone, 'Invalid PIN', {
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException('Invalid phone number or PIN');
      }

      // Update last login and FCM token if provided
      const updateData: {
        lastLoginAt: Date;
        fcmToken?: string;
        fcmTokenUpdatedAt?: Date;
      } = { lastLoginAt: new Date() };

      if (fcmToken) {
        if (fcmToken.length > 10 && fcmToken.includes(':')) {
          updateData.fcmToken = fcmToken;
          updateData.fcmTokenUpdatedAt = new Date();
          console.log(`✅ FCM token updated for user ${user.phone}`);
        } else {
          console.warn(
            `⚠️ Invalid FCM token format for user ${user.phone}: ${fcmToken.substring(0, 20)}...`,
          );
        }
      }

      await this.prismaService.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Log successful login
      await this.activityService.logLogin({
        userId: user.id,
        cooperativeId: user.cooperativeId || undefined,
        ipAddress,
        userAgent,
      });

      // Generate JWT
      const payload: JwtPayload = {
        sub: user.id,
        phone: user.phone,
        role: user.role,
        cooperativeId: user.cooperativeId || undefined,
      };

      const accessToken = this.jwtService.sign(payload);
      const expiresIn = this.getTokenExpirationInSeconds();

      return {
        accessToken,
        tokenType: 'Bearer',
        expiresIn,
        user: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          email: user.email || undefined,
          role: user.role,
          status: user.status,
          cooperativeId: user.cooperativeId || undefined,
        },
      };
    } catch (error) {
      // Re-throw known exceptions
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Log unknown errors
      await this.activityService.logFailedLogin(
        phone,
        'System error during login',
        { ipAddress, userAgent },
      );

      throw new UnauthorizedException('Login failed');
    }
  }

  async validateUser(phone: string, pin: string) {
    const user = await this.prismaService.user.findUnique({
      where: { phone },
    });

    if (user && (await bcrypt.compare(pin, user.pin))) {
      return user;
    }
    return null;
  }

  private getTokenExpirationInSeconds(): number {
    const expiresIn = this.configService.get<string>('jwt.expiresIn');

    // Convert JWT expiration string to seconds
    if (typeof expiresIn === 'string') {
      const unit = expiresIn.slice(-1);
      const value = parseInt(expiresIn.slice(0, -1));

      switch (unit) {
        case 'd':
          return value * 24 * 60 * 60; // days to seconds
        case 'h':
          return value * 60 * 60; // hours to seconds
        case 'm':
          return value * 60; // minutes to seconds
        case 's':
          return value; // already seconds
        default:
          return 7 * 24 * 60 * 60; // default 7 days
      }
    }

    return 7 * 24 * 60 * 60; // default 7 days
  }

  async forgotPin(
    forgotPinDto: ForgotPinDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ForgotPinResponseDto> {
    const { phone } = forgotPinDto;

    // Find user by phone
    const user = await this.prismaService.user.findUnique({
      where: { phone },
    });

    if (!user) {
      throw new NotFoundException('No account found with this phone number');
    }

    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Account is not active');
    }

    // Generate 6-digit reset token
    const resetToken = crypto.randomInt(100000, 999999).toString();
    const hashedResetToken = await bcrypt.hash(resetToken, 10);

    // Set expiration to 15 minutes from now
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Update user with reset token
    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedResetToken,
        passwordResetExpires: resetTokenExpires,
      },
    });

    // Log PIN reset request
    await this.activityService.logPinReset(
      {
        userId: user.id,
        cooperativeId: user.cooperativeId || undefined,
        ipAddress,
        userAgent,
      },
      true, // isRequested = true
    );

    // Send SMS with reset token
    try {
      const smsResult = await this.smsService.sendPinResetSms(
        phone,
        resetToken,
      );

      if (!smsResult.success) {
        // Log the error but don't fail the request
        console.error(`Failed to send SMS to ${phone}:`, smsResult.error);
        console.log(`Reset token for ${phone}: ${resetToken} (SMS failed)`);
      } else {
        console.log(`Reset token sent via SMS to ${phone}: ${resetToken}`);
      }
    } catch (error) {
      // Log the error but don't fail the request
      console.error(`SMS service error for ${phone}:`, error.message);
      console.log(`Reset token for ${phone}: ${resetToken} (SMS error)`);
    }

    console.log(`Token expires at: ${resetTokenExpires.toISOString()}`);

    // Mask phone number for response
    const maskedPhone = this.maskPhoneNumber(phone);

    return {
      message: 'Reset token sent successfully',
      expiresAt: resetTokenExpires.toISOString(),
      maskedPhone,
    };
  }

  async resetPin(
    resetPinDto: ResetPinDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const { phone, resetToken, newPin } = resetPinDto;

    // Find user by phone
    const user = await this.prismaService.user.findUnique({
      where: { phone },
    });

    if (!user) {
      throw new NotFoundException('No account found with this phone number');
    }

    if (!user.passwordResetToken || !user.passwordResetExpires) {
      throw new BadRequestException(
        'No reset token found. Please request a new one.',
      );
    }

    // Check if token has expired
    if (new Date() > user.passwordResetExpires) {
      throw new BadRequestException(
        'Reset token has expired. Please request a new one.',
      );
    }

    // Verify reset token
    const isTokenValid = await bcrypt.compare(
      resetToken,
      user.passwordResetToken,
    );
    if (!isTokenValid) {
      throw new BadRequestException('Invalid reset token');
    }

    // Hash new PIN
    const hashedPin = await bcrypt.hash(newPin, 10);

    // Update user with new PIN and clear reset token
    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        pin: hashedPin,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Log PIN reset completion
    await this.activityService.logPinReset(
      {
        userId: user.id,
        cooperativeId: user.cooperativeId || undefined,
        ipAddress,
        userAgent,
      },
      false, // isRequested = false (completed)
    );

    // Send SMS confirmation for successful PIN reset
    try {
      const smsResult = await this.smsService.sendPinResetSuccessSms(phone);

      if (!smsResult.success) {
        // Log the error but don't fail the request
        console.error(
          `Failed to send PIN reset success SMS to ${phone}:`,
          smsResult.error,
        );
      } else {
        console.log(`PIN reset success SMS sent to ${phone}`);
      }
    } catch (error) {
      // Log the error but don't fail the request
      console.error(`SMS service error for ${phone}:`, error.message);
    }

    return {
      message: 'PIN reset successfully',
    };
  }

  async logout(
    userId: string,
    logoutDto: LogoutDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    try {
      // Find user to get current info
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          phone: true,
          cooperativeId: true,
          fcmToken: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // No need to update user data for logout since FCM token should remain

      // Log logout activity
      await this.activityService.logLogout({
        userId: user.id,
        cooperativeId: user.cooperativeId || undefined,
        ipAddress,
        userAgent,
      });

      console.log(`👋 User ${user.phone} logged out successfully`);

      return {
        message: 'Logout successful',
      };
    } catch (error) {
      // Re-throw known exceptions
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Log unknown errors
      console.error('Logout error:', error.message);
      throw new UnauthorizedException('Logout failed');
    }
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length < 8) return phone;

    // For +250788000001, return +2507880****1
    const start = phone.substring(0, phone.length - 5);
    const end = phone.substring(phone.length - 1);
    const masked = '*'.repeat(4);

    return `${start}${masked}${end}`;
  }
}
