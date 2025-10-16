import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from '../presentation/dto/login.dto';
import { AuthResponseDto } from '../presentation/dto/auth-response.dto';
import { JwtPayload } from '../infrastructure/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { phone, pin } = loginDto;

    // Find user by phone
    const user = await this.prismaService.user.findUnique({
      where: { phone },
      include: { cooperative: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid phone number or PIN');
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(pin, user.pin);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid phone number or PIN');
    }

    // Update last login
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
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
    const expiresIn = this.configService.get('jwt.expiresIn');

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
}
